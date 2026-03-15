const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    logo: {
      type: String,
      trim: true,
      default: ''
    },
    _id: {
      type: String,
      default: 'company'
    }
  },
  {
    timestamps: true,
    _id: false
  }
);

companySchema.statics.getCompany = async function () {
  let company = await this.findById('company');
  if (!company) {
    try {
      company = await this.create({ _id: 'company' });
    } catch (err) {
      if (err.code === 11000) {
        company = await this.findById('company');
      } else {
        throw err;
      }
    }
  }
  return company;
};

companySchema.statics.updateCompany = async function (updates) {
  const company = await this.getCompany();
  const allowed = ['companyName', 'phone', 'address', 'logo'];
  allowed.forEach((key) => {
    if (updates[key] !== undefined) {
      company[key] = updates[key];
    }
  });
  await company.save();
  return company;
};

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
