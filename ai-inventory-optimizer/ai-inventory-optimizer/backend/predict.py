#!/usr/bin/env python3
"""
predict.py
Final AI prediction engine for AI-Powered Inventory Optimization System.

Input: JSON on stdin with keys:
  {
    "sales": [ { "product": "...", "date": "YYYY-MM-DD", "quantity": N, ... }, ... ],
    "products": [ { "product": "...", "currentstock": N, "shelflife": D, "leadtime": L, ... }, ... ],
    "config": { "lead_time_days": 7, ... }
  }

Output: JSON printed to stdout:
  {
    "predictions": [ {...}, ... ],
    "chart_data": [ {...}, ... ]
  }
"""
import sys
import json
from datetime import timedelta
import pandas as pd
import numpy as np

# ------------------------ Helpers ------------------------
def to_py(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if pd.isna(v):
        return None
    return v

def clean_obj(o):
    if isinstance(o, dict):
        return {k: clean_obj(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean_obj(v) for v in o]
    return to_py(o)

# ------------------------ Normalizers ------------------------
def normalize_sales_df(sales):
    df = pd.DataFrame(sales if sales is not None else [])
    if df.empty:
        df = pd.DataFrame(columns=['product', 'date', 'quantity'])
    df.columns = [str(c).strip().lower().replace('\ufeff','') for c in df.columns]
    mapping = {}
    for c in df.columns:
        if c in ('product_name','product','item','name'): mapping[c] = 'product'
        if c in ('sale_date','date','timestamp'): mapping[c] = 'date'
        if c in ('quantity','quantity_sold','qty','q'): mapping[c] = 'quantity'
        if c in ('unit_price','price'): mapping[c] = 'price'
    if mapping:
        df = df.rename(columns=mapping)
    if 'quantity' in df.columns:
        df['quantity'] = pd.to_numeric(df['quantity'].astype(str).str.replace(',','').str.strip(), errors='coerce').fillna(0)
    else:
        df['quantity'] = 0
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    else:
        df['date'] = pd.NaT
    if 'product' in df.columns:
        df['product'] = df['product'].astype(str).str.strip()
    return df

def normalize_products_df(products):
    df = pd.DataFrame(products if products is not None else [])
    if df.empty:
        df = pd.DataFrame(columns=['product','currentstock','shelflife','leadtime'])
    df.columns = [str(c).strip().lower().replace('\ufeff','') for c in df.columns]
    rename = {
        'current stock': 'currentstock', 'stock': 'currentstock', 'stock_level': 'currentstock',
        'shelf_life_days': 'shelflife', 'shelf life': 'shelflife', 'expiry_days': 'shelflife',
        'lead_time_days': 'leadtime', 'batch_stock': 'currentstock'
    }
    df = df.rename(columns={c: rename.get(c,c) for c in df.columns})
    if 'currentstock' in df.columns:
        df['currentstock'] = pd.to_numeric(df['currentstock'].astype(str).str.replace(',','').str.strip(), errors='coerce').fillna(0)
    else:
        df['currentstock'] = 0
    if 'shelflife' in df.columns:
        df['shelflife'] = pd.to_numeric(df['shelflife'], errors='coerce').fillna(np.nan)
    else:
        df['shelflife'] = np.nan
    if 'leadtime' in df.columns:
        df['leadtime'] = pd.to_numeric(df['leadtime'], errors='coerce').fillna(np.nan)
    return df

# ------------------------ AI Rules ------------------------
def rule_weekday_peak(daily_series):
    try:
        df = daily_series.copy()
        if df.empty:
            return None
        df['weekday'] = df['date'].dt.dayofweek
        wd_mean = df.groupby('weekday')['quantity'].mean()
        if wd_mean.empty:
            return None
        top = int(wd_mean.idxmax())
        top_val = float(wd_mean.loc[top])
        overall = float(wd_mean.mean())
        if overall > 0 and top_val > overall * 1.25:
            wd_names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
            return f"Peak sales on {wd_names[top]} (avg {round(top_val,1)}). Consider stocking up before that day."
    except Exception:
        return None

def rule_weekend_uplift(daily_series):
    try:
        df = daily_series.copy()
        if df.empty:
            return None
        df['weekday'] = df['date'].dt.dayofweek
        wknd = float(df[df['weekday']>=5]['quantity'].mean()) if not df[df['weekday']>=5].empty else 0.0
        wkday = float(df[df['weekday']<5]['quantity'].mean()) if not df[df['weekday']<5].empty else 0.0
        if wkday > 0 and wknd > wkday * 1.2:
            return "Weekend uplift detected — consider increasing stock on Thu/Fri to meet weekend demand."
    except Exception:
        return None

def rule_monthly_spike(daily_series):
    try:
        df = daily_series.copy()
        if df.empty:
            return None
        df['month'] = df['date'].dt.month
        mmean = df.groupby('month')['quantity'].mean()
        if mmean.empty:
            return None
        topm = int(mmean.idxmax())
        if float(mmean.loc[topm]) > float(mmean.mean()) * 1.4:
            return f"Monthly spike detected for month {topm} — prepare extra stock before that month."
    except Exception:
        return None

def rule_short_term_trend(daily_series):
    try:
        df = daily_series.copy().sort_values('date').set_index('date').asfreq('D', fill_value=0)
        if len(df) < 14:
            return None
        q7 = df['quantity'].rolling(7, min_periods=1).mean()
        last7 = float(q7.iloc[-1])
        prev7 = float(q7.iloc[-8]) if len(q7) >= 8 else None
        if prev7 and prev7 > 0:
            pct = (last7 - prev7) / prev7
            if pct > 0.2:
                return f"7-day rising trend (+{int(pct*100)}%) — consider ordering extra units to avoid stockouts."
            if pct < -0.2:
                return f"7-day falling trend ({int(pct*100)}%) — consider reducing next order or running promotions."
    except Exception:
        return None

def rule_fast_slow_mover(avg_daily, current_stock, monthly_mean):
    try:
        if monthly_mean is None or monthly_mean == 0:
            return None
        if current_stock > monthly_mean * 3:
            return "Overstock detected (stock > 3× monthly avg). Consider clearance or reduce future orders."
        if avg_daily > monthly_mean * 1.5:
            return "Fast mover — increase reorder frequency or quantity."
        if avg_daily < monthly_mean * 0.4:
            return "Slow mover — consider smaller reorders and promotional offers."
    except Exception:
        return None

def rule_expiry_discounting(expiry_risk, shelf_life, days_to_sell, current_stock):
    try:
        if expiry_risk == "High":
            return "High expiry risk — apply aggressive discount (e.g., 30%) and prioritize older batches (FIFO)."
        if expiry_risk == "Medium":
            return "Medium expiry risk — consider a moderate discount (10%–20%) and monitor daily."
        if shelf_life and shelf_life < 7 and days_to_sell and days_to_sell > shelf_life:
            return "Short shelf life combined with slow sales — immediate discounting recommended."
    except Exception:
        return None

def rule_anomaly_insight(anomaly):
    if not anomaly:
        return None
    reason = anomaly.get('reason')
    if reason == 'spike':
        return "Unusual sales spike detected — investigate promotion or data entry issues."
    if reason == 'drop':
        return "Unusual sales drop detected — check for stockouts, display or supplier problems."
    return None

def rule_bundle_crosssell(product, sales_df):
    try:
        if sales_df.empty:
            return None
        pivot = sales_df.pivot_table(index='date', columns='product', values='quantity', aggfunc='sum', fill_value=0)
        if product not in pivot.columns:
            return None
        corrs = pivot.corrwith(pivot[product]).drop(labels=[product], errors='ignore').dropna()
        if corrs.empty:
            return None
        top = corrs.idxmax()
        val = corrs.max()
        if val > 0.45:
            return f"Consider bundling with '{top}' (correlation {round(val,2)})."
    except Exception:
        return None

# ------------------------ Main prediction function ------------------------
def predict_inventory(payload):
    sales = payload.get('sales', []) or []
    products = payload.get('products', []) or []
    config = payload.get('config', {}) or {}
    default_lead = int(config.get('lead_time_days', 7))

    sales_df = normalize_sales_df(sales)
    products_df = normalize_products_df(products)

    if 'product' in sales_df.columns and 'date' in sales_df.columns:
        daily = sales_df.groupby(['product', 'date'])['quantity'].sum().reset_index()
    else:
        daily = pd.DataFrame(columns=['product','date','quantity'])

    product_set = sorted(set(products_df['product'].dropna().unique().tolist()) |
                         set(daily['product'].dropna().unique().tolist()))

    monthly_avg = None
    try:
        md = sales_df.copy()
        if (not md.empty) and ('date' in md.columns):
            md['month'] = md['date'].dt.to_period('M')
            monthly_avg = md.groupby(['product','month'])['quantity'].sum().groupby('product').mean()
    except Exception:
        monthly_avg = None

    predictions = []
    chart_data = []

    for product in product_set:
        prod_rows = products_df[products_df['product'] == product]
        if not prod_rows.empty:
            row = prod_rows.iloc[0]
            current_stock = float(row.get('currentstock', 0) or 0)
            try:
                shelf_val = row.get('shelflife', None)
                shelf_life = float(shelf_val) if shelf_val is not None and not pd.isna(shelf_val) else np.nan
            except Exception:
                shelf_life = np.nan
            try:
                lt = row.get('leadtime', None)
                lead_time = int(lt) if lt is not None and str(lt).strip() != '' else default_lead
            except Exception:
                lead_time = default_lead
        else:
            current_stock = 0.0
            shelf_life = np.nan
            lead_time = default_lead

        prod_daily = daily[daily['product'] == product].copy()
        avg_daily = 0.0
        chart_series = []
        if not prod_daily.empty:
            first = prod_daily['date'].min()
            last = prod_daily['date'].max()
            idx = pd.date_range(first, last, freq='D')
            s = prod_daily.set_index('date').reindex(idx, fill_value=0)['quantity']
            s = pd.to_numeric(s, errors='coerce').fillna(0)
            avg_daily = float(s.mean())
            chart_series = [{'date': d.strftime('%Y-%m-%d'), 'quantity': int(s.loc[d])} for d in s.index]
        else:
            avg_daily = 0.0

        lead_demand = avg_daily * lead_time
        safety_stock = avg_daily * 1.5
        recommended_reorder = max(0.0, lead_demand + safety_stock - current_stock)

        expiry_risk = "Unknown"
        days_to_sell = None
        if not np.isnan(shelf_life):
            if avg_daily <= 0:
                expiry_risk = "High"
            else:
                days_to_sell = current_stock / avg_daily if avg_daily > 0 else float('inf')
                if days_to_sell > shelf_life:
                    expiry_risk = "High"
                elif days_to_sell > shelf_life * 0.6:
                    expiry_risk = "Medium"
                else:
                    expiry_risk = "Low"

        suggested_discount = "0%"
        if expiry_risk == "High":
            suggested_discount = "30%"
        elif expiry_risk == "Medium":
            suggested_discount = "10%"

        predicted_loss = 0
        if expiry_risk == "High":
            predicted_loss = int(round(current_stock * 0.6))
        elif expiry_risk == "Medium":
            predicted_loss = int(round(current_stock * 0.25))

        anomaly = None
        if not prod_daily.empty:
            pdaily = prod_daily.set_index('date').resample('D').sum().reindex(
                pd.date_range(prod_daily['date'].min(), prod_daily['date'].max()), fill_value=0
            )
            pdaily['quantity'] = pd.to_numeric(pdaily['quantity'], errors='coerce').fillna(0)
            last_qty = int(pdaily['quantity'].iloc[-1])
            avg30 = float(pdaily['quantity'].tail(30).mean()) if len(pdaily) > 0 else 0.0
            if avg30 > 0:
                if last_qty >= avg30 * 3:
                    anomaly = {'anomaly': True, 'reason': 'spike', 'yesterday': int(last_qty), 'avg30': round(avg30,2)}
                elif last_qty <= avg30 * 0.1:
                    anomaly = {'anomaly': True, 'reason': 'drop', 'yesterday': int(last_qty), 'avg30': round(avg30,2)}

        ais = []
        ds = prod_daily.copy()
        if not ds.empty:
            ds = ds[['date','quantity']]

        for rule in (rule_short_term_trend, rule_weekday_peak, rule_weekend_uplift, rule_monthly_spike):
            try:
                r = rule(ds)
                if r:
                    ais.append(r)
            except Exception:
                continue

        monthly_mean = avg_daily * 30
        if monthly_avg is not None and product in monthly_avg.index:
            try:
                monthly_mean = float(monthly_avg.loc[product])
            except Exception:
                monthly_mean = avg_daily * 30
        fastslow = rule_fast_slow_mover(avg_daily, current_stock, monthly_mean)
        if fastslow:
            ais.append(fastslow)

        ed = rule_expiry_discounting(expiry_risk, shelf_life, days_to_sell if days_to_sell else None, current_stock)
        if ed:
            ais.append(ed)

        an = rule_anomaly_insight(anomaly)
        if an:
            ais.append(an)

        b = rule_bundle_crosssell(product, sales_df)
        if b:
            ais.append(b)

        if not ais:
            if avg_daily <= 0:
                ais = ["No recent sales data — perform stock and sales audit or import more sales history."]
            else:
                ais = ["No strong patterns detected — monitor weekly and adjust orders based on demand."]

        predictions.append({
            "Product": product,
            "CurrentStock": int(current_stock),
            "AvgDailySales_est": round(avg_daily, 2),
            "LeadTimeDays": int(lead_time),
            "ForecastDemand_leadtime": round(lead_demand, 2),
            "SafetyStock": round(safety_stock, 2),
            "RecommendedReorderQty": round(recommended_reorder, 2),
            "ExpiryRisk": expiry_risk,
            "SuggestedDiscount": suggested_discount,
            "PredictedLoss": int(predicted_loss),
            "Anomaly": anomaly,
            "FIFOSuggestion": "Sell oldest batch first (FIFO).",
            "AISuggestions": ais
        })

        chart_data.append({
            "Product": product,
            "AvgDailySales": round(avg_daily, 2),
            "CurrentStock": int(current_stock),
            "ForecastDemand": round(lead_demand, 2)
        })

    return {"predictions": predictions, "chart_data": chart_data}

# ------------------------ CLI ------------------------
def main():
    raw = sys.stdin.read()
    if not raw:
        sys.stderr.write("ERROR: no input\n")
        sys.exit(1)
    try:
        payload = json.loads(raw)
    except Exception as e:
        sys.stderr.write("ERROR: invalid JSON input: " + str(e) + "\n")
        sys.exit(1)
    try:
        output = predict_inventory(payload)
        print(json.dumps(clean_obj(output), ensure_ascii=False))
    except Exception as e:
        sys.stderr.write("ERROR in Python script: " + str(e) + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
