const User = require('../models/User');

const ensureUser = async (userConfig) => {
  const existingUser = await User.findOne({ email: userConfig.email });

  if (existingUser) {
    return {
      user: existingUser,
      created: false
    };
  }

  const user = await User.create(userConfig);
  return {
    user,
    created: true
  };
};

const bootstrapUsers = async () => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const shouldBootstrap = process.env.BOOTSTRAP_DEFAULT_USERS !== 'false';
  if (!shouldBootstrap) {
    return;
  }

  const defaults = [
    {
      username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@roadfix.com',
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
      role: 'admin',
      office: process.env.DEFAULT_ADMIN_OFFICE || 'Municipal Corporation',
      department: process.env.DEFAULT_ADMIN_DEPARTMENT || 'Administration',
      profile: {
        firstName: 'System',
        lastName: 'Administrator'
      }
    },
    {
      username: process.env.DEFAULT_USER_USERNAME || 'user_john',
      email: process.env.DEFAULT_USER_EMAIL || 'john.doe@example.com',
      password: process.env.DEFAULT_USER_PASSWORD || 'user123',
      role: 'user',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main Street, City Center'
      }
    }
  ];

  for (const userConfig of defaults) {
    const result = await ensureUser(userConfig);
    if (result.created) {
      console.log(`Bootstrapped default ${userConfig.role}: ${userConfig.email}`);
    }
  }
};

module.exports = bootstrapUsers;
