const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────
//  Teacher Schema
//  Represents a teacher who can log in and manage sessions.
// ─────────────────────────────────────────────────────────────
const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,               // No two teachers can share an email
      lowercase: true,            // Always store email in lowercase
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,              // NEVER return password in queries by default
    },

    institution: {
      type: String,
      trim: true,
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,             // Adds createdAt and updatedAt automatically
  }
);

// ─────────────────────────────────────────────────────────────
//  Pre-save hook — hash password before saving to DB
//  Only runs if the passwordHash field was modified
// ─────────────────────────────────────────────────────────────
teacherSchema.pre('save', async function (next) {
  // If password hasn't changed, skip hashing
  if (!this.isModified('passwordHash')) return next();

  // Hash with salt rounds = 12 (strong but not too slow)
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// ─────────────────────────────────────────────────────────────
//  Instance method — compare plain password with stored hash
//  Called during login: teacher.comparePassword(plainPassword)
// ─────────────────────────────────────────────────────────────
teacherSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// ─────────────────────────────────────────────────────────────
//  Instance method — return safe public profile (no password)
// ─────────────────────────────────────────────────────────────
teacherSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    institution: this.institution,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Teacher', teacherSchema);
