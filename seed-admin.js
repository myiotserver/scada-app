const db = require("./models"); // Adjusted path if running from root of app
const User = db.user;
const Role = db.role;
const bcrypt = require("bcrypt");

db.sequelize.sync().then(() => {
    console.log('Sync completed. Seeding Admin...');
    seedAdmin();
});

async function seedAdmin() {
    try {
        const roles = await Role.findAll();
        if (roles.length === 0) {
            console.log("Roles not found, run the server once to init roles.");
            return;
        }

        const adminRole = await Role.findOne({ where: { name: 'admin' } });

        // Check if admin exists
        const user = await User.findOne({ where: { username: 'admin' } });
        if (!user) {
            const newAdmin = await User.create({
                username: 'admin',
                email: 'admin@scada.local',
                password: bcrypt.hashSync('admin123', 8)
            });
            await newAdmin.setRoles([adminRole]);
            console.log("Admin user created: admin / admin123");
        } else {
            console.log("Admin user already exists.");
        }
    } catch (error) {
        console.error("Seeding failed:", error);
    } finally {
        process.exit();
    }
}
