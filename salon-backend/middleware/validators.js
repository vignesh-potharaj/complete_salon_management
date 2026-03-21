const { body, validationResult } = require('express-validator');

// ── Middleware: run after validation rules, return errors if any ──
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg  // return first error message only
    });
  }
  next();
};

// ── Auth ──────────────────────────────────────────────────────────
const validateRegister = [
  body('userId')
    .trim()
    .notEmpty().withMessage('User ID is required')
    .isLength({ min: 3, max: 30 }).withMessage('User ID must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9._]+$/).withMessage('User ID can only contain letters, numbers, dots and underscores'),

  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),

  body('salonName')
    .trim()
    .notEmpty().withMessage('Salon name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Salon name must be between 2 and 100 characters'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  validate
];

const validateLogin = [
  body('userId')
    .trim()
    .notEmpty().withMessage('User ID is required'),

  body('password')
    .notEmpty().withMessage('Password is required'),

  validate
];

// ── Clients ───────────────────────────────────────────────────────
const validateClient = [
  body('name')
    .trim()
    .notEmpty().withMessage('Client name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9]{10}$/).withMessage('Phone must be a valid 10-digit number'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female or Other'),

  validate
];

// ── Staff ─────────────────────────────────────────────────────────
const validateStaff = [
  body('name')
    .trim()
    .notEmpty().withMessage('Staff name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

  body('role')
    .trim()
    .notEmpty().withMessage('Role is required')
    .isLength({ max: 50 }).withMessage('Role must be under 50 characters'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9]{10}$/).withMessage('Phone must be a valid 10-digit number'),

  body('commission')
    .notEmpty().withMessage('Commission is required')
    .isFloat({ min: 0, max: 100 }).withMessage('Commission must be between 0 and 100'),

  validate
];

// ── Inventory ─────────────────────────────────────────────────────
const validateInventory = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ max: 100 }).withMessage('Product name must be under 100 characters'),

  body('category')
    .trim()
    .notEmpty().withMessage('Category is required'),

  body('stock')
    .notEmpty().withMessage('Stock is required')
    .isInt({ min: 0 }).withMessage('Stock must be a positive number'),

  body('minStock')
    .notEmpty().withMessage('Minimum stock is required')
    .isInt({ min: 0 }).withMessage('Minimum stock must be a positive number'),

  body('purchasePrice')
    .notEmpty().withMessage('Purchase price is required')
    .isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),

  body('sellingPrice')
    .notEmpty().withMessage('Selling price is required')
    .isFloat({ min: 0 }).withMessage('Selling price must be a positive number')
    .custom((sellingPrice, { req }) => {
      if (parseFloat(sellingPrice) <= parseFloat(req.body.purchasePrice)) {
        throw new Error('Selling price must be greater than purchase price');
      }
      return true;
    }),

  body('supplierPhone')
    .optional({ checkFalsy: true })
    .matches(/^[0-9]{10}$/).withMessage('Supplier phone must be a valid 10-digit number'),

  validate
];

// ── Appointments ──────────────────────────────────────────────────
const validateAppointment = [
  body('clientName')
    .trim()
    .notEmpty().withMessage('Client name is required')
    .isLength({ max: 50 }).withMessage('Client name must be under 50 characters'),

  body('service')
    .trim()
    .notEmpty().withMessage('Service is required')
    .isLength({ max: 100 }).withMessage('Service must be under 100 characters'),

  body('time')
    .notEmpty().withMessage('Time is required'),

  body('status')
    .optional()
    .isIn(['Upcoming', 'Ongoing', 'Completed', 'Cancelled']).withMessage('Invalid status value'),

  validate
];

// ── Bills ─────────────────────────────────────────────────────────
const validateBill = [
  body('clientName')
    .trim()
    .notEmpty().withMessage('Client name is required')
    .isLength({ max: 50 }).withMessage('Client name must be under 50 characters'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),

  body('items.*.name')
    .trim()
    .notEmpty().withMessage('Item name is required'),

  body('items.*.type')
    .isIn(['Service', 'Product']).withMessage('Item type must be Service or Product'),

  body('items.*.qty')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  body('items.*.price')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('subtotal')
    .isFloat({ min: 0 }).withMessage('Subtotal must be a positive number'),

  body('grandTotal')
    .isFloat({ min: 0 }).withMessage('Grand total must be a positive number'),

  body('paymentMethod')
    .optional()
    .isIn(['Cash', 'UPI', 'Card', 'Other']).withMessage('Invalid payment method'),

  validate
];

module.exports = {
  validateRegister,
  validateLogin,
  validateClient,
  validateStaff,
  validateInventory,
  validateAppointment,
  validateBill
};