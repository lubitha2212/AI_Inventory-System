const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { roles } = require('../utils/role');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ✅ Helper function to create token with correct payload
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role }, // 🔹 Always include id & role
    JWT_SECRET,
    { expiresIn: '1d' }
  );
};

// ✅ Register a new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Role validation
    const assignedRole = role || roles.CUSTOMER;
    if (![roles.ADMIN, roles.CUSTOMER].includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: assignedRole,
    });

    await user.save();

    // Generate JWT with correct payload
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// ✅ Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate JWT with correct payload
    const token = generateToken(user);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};
