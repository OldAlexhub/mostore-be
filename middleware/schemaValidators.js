import Joi from 'joi';
import { validateBody } from './validate.js';

const adminCreateSchema = Joi.object({
  username: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('superadmin', 'manager', 'staff').optional()
});

const adminLoginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const productSchema = Joi.object({
  Number: Joi.number().required(),
  Name: Joi.string().required(),
  QTY: Joi.number().min(0).required(),
  Sell: Joi.number().min(0).required(),
  Category: Joi.string().optional(),
  Subcategory: Joi.string().optional(),
  Material: Joi.string().optional(),
  Season: Joi.string().optional(),
  Style: Joi.string().optional()
});

const userCreateSchema = Joi.object({
  username: Joi.string().min(3).required(),
  Address: Joi.string().required(),
  phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required()
});

export const validateAdminCreate = validateBody(adminCreateSchema);
export const validateAdminLogin = validateBody(adminLoginSchema);
export const validateProduct = validateBody(productSchema);
export const validateUserCreate = validateBody(userCreateSchema);
