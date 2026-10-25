
require('dotenv').config();
const db = require('./models');
const Role = db.role;
const User = db.user;
const bcrypt = require('bcrypt');

async function init() {
  await db.sequelize.sync();
  await Role.findOrCreate({ where: { id: 1, name: 'user' } });
  await Role.findOrCreate({ where: { id: 2, name: 'moderator' } });
  const [adminRole] = await Role.findOrCreate({ where: { id: 3, name: 'admin' } });
  await Role.findOrCreate({ where: { id: 4, name: 'guest' } });

  let user = await User.findOne({ where: { username: 'admin' } });
  if (!user) {
    user = await User.create({
      username: 'admin',
      email: 'admin@scada.local',
      password: bcrypt.hashSync('Admin@Scada2026!', 8),
      mustChangePassword: false
    });
    await user.setRoles([adminRole]);
    console.log('Admin user created successfully!');
  } else {
    user.password = bcrypt.hashSync('Admin@Scada2026!', 8);
    await user.save();
    await user.setRoles([adminRole]);
    console.log('Admin password updated successfully!');
  }
  process.exit(0);
}
init().catch(err => {
  console.error(err);
  process.exit(1);
});
