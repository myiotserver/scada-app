const db = require('./models');

console.log("Menyelaraskan skema database...");
db.sequelize.sync({ alter: true }).then(() => {
    console.log("Skema database berhasil diperbarui. Kolom yang hilang (seperti mustChangePassword) telah ditambahkan.");
    process.exit(0);
}).catch(err => {
    console.error("Gagal memperbarui database:", err);
    process.exit(1);
});
