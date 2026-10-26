/**
 * SCADA Unified - Carousel Logic
 */

// ==========================================================================
// BILINGUAL TRANSLATION SYSTEM (ID / EN)
// ==========================================================================
const translations = {
    id: {
        // General & Header
        sriboga_tagline: "PIONEER IN FLOUR INNOVATION",
        header_title: "DASHBOARD TIMBANGAN",
        theme_toggle_title: "Ganti tema tampilan",
        nav_home: "Beranda",
        nav_config: "Konfigurasi",
        nav_users: "Pengguna",
        nav_opcua: "OPC",
        nav_history: "Riwayat",
        nav_logs: "Log Sistem",
        nav_audit: "Audit Trail",
        nav_logout: "Keluar",
        btn_signin: "Masuk",

        // Home View / Carousel Cards
        updating_data: "Memperbarui Data...",
        carousel_n: "Carousel {n}",
        card_product_id: "ID Produk",
        card_packing_order: "Order Kemasan",
        card_package: "Kemasan",
        card_tolerance: "Toleransi",
        card_pack_weight: "Berat Kemasan",
        card_gross_weight: "Berat Bruto",
        card_counter_pcs: "Hitungan: {n} Pcs",
        card_target_pcs: "Target: {n} Pcs",
        card_stats_tooltip: "Statistik berdasarkan 1 jam produksi terakhir",
        card_min_1h: "Min (1j)",
        card_nett: "Netto",
        card_avg_1h: "Rata-rata (1j)",
        card_btn_update: "Perbarui Data",
        card_waiting_order: "Menunggu Order Kemasan",
        card_md_status: "Interlock",

        // Config View
        config_title: "Konfigurasi Sistem",
        config_subtitle: "Pengaturan interlock underweight dan koneksi server database SQL",
        interlock_panel_title: "Batas Deviasi & Interlock Metal Detector",
        lower_limit_label: "Threshold Lower Limit :",
        upper_limit_label: "Threshold Upper Limit :",
        sql_panel_title: "Pengaturan SQL Server",
        checking: "MEMERIKSA...",
        lbl_server: "Server :",
        lbl_port: "Port :",
        lbl_uid: "UID :",
        lbl_pass: "PASS :",
        lbl_db: "Database :",
        lbl_table_zero: "Tabel Zeroing :",
        lbl_table_weight: "Tabel Bobot :",
        lbl_table_preset: "Tabel Preset Data :",
        lbl_auto_reconnect: "Auto-Reconnect :",
        btn_save_settings: "SIMPAN PENGATURAN",
        dev_min_label: "Dev.Min :",
        normal_label: "Normal",
        interlock_label: "Interlock",
        admin_only_interlock: "Hanya admin yang dapat mengubah konfigurasi interlock.",
        admin_only_deviation: "Hanya admin yang dapat mengubah batas deviasi.",
        admin_only_sql: "Hanya admin yang dapat mengubah pengaturan SQL Server.",
        confirm_interlock_title: "Konfirmasi Interlock Carousel {n}",
        confirm_interlock_under_title: "Konfirmasi Interlock Threshold Lower Limit CR{n}",
        confirm_interlock_under_desc: "Apakah Anda yakin ingin mengubah status Interlock Batas Bawah (Underweight) untuk <strong>Carousel {n}</strong> menjadi {status}?",
        confirm_interlock_over_title: "Konfirmasi Interlock Threshold Upper Limit CR{n}",
        confirm_interlock_over_desc: "Apakah Anda yakin ingin mengubah status Interlock Batas Atas (Overweight) untuk <strong>Carousel {n}</strong> menjadi {status}?",
        confirm_deviation_min_title: "Konfirmasi Threshold Lower Limit",
        confirm_deviation_min_desc: "Apakah Anda yakin ingin mengubah batas deviasi Lower Limit (Underweight) untuk <strong>Carousel {n}</strong> dari <strong>{oldVal} Kg</strong> menjadi <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_deviation_max_title: "Konfirmasi Threshold Upper Limit",
        confirm_deviation_max_desc: "Apakah Anda yakin ingin mengubah batas deviasi Upper Limit (Overweight) untuk <strong>Carousel {n}</strong> dari <strong>{oldVal} Kg</strong> menjadi <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_interlock_desc: "Apakah Anda yakin ingin mengubah status Underweight Interlock untuk <strong>Carousel {n}</strong> menjadi {status}?",
        confirm_deviation_title: "Konfirmasi Deviasi Minimum",
        confirm_deviation_desc: "Apakah Anda yakin ingin mengubah batas deviasi minimum untuk <strong>Carousel {n}</strong> dari <strong>{oldVal} Kg</strong> menjadi <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_sql_title: "Konfirmasi Pengaturan SQL Server",
        confirm_sql_desc: "Apakah Anda yakin ingin menyimpan konfigurasi database <strong>SQL Server</strong>?",
        confirm_sql_diff_title: "Apakah Anda yakin ingin menyimpan perubahan konfigurasi <strong>SQL Server</strong> berikut?",
        status_on: "AKTIF (ON)",
        status_off: "NONAKTIF (OFF)",

        // Users View
        users_title: "Manajemen Pengguna",
        users_subtitle: "Kelola akun pengguna, peran otorisasi, dan kredensial sistem",
        btn_add_user: "Tambah Pengguna",
        th_user_id: "ID",
        th_user_name: "Username",
        th_user_roles: "Peran (Roles)",
        th_user_actions: "Tindakan",
        btn_edit: "Ubah",
        btn_delete: "Hapus",
        confirm_delete_user: "Apakah Anda yakin ingin menghapus pengguna ini?",
        user_updated_success: "User berhasil diperbarui",
        user_created_success: "User berhasil dibuat",

        // OPC-UA View
        opcua_title: "Antarmuka OPC-UA",
        opcua_subtitle: "Konfigurasi koneksi industrial PLC, profil keamanan, dan pemantauan tag live",
        opcua_conn_title: "Koneksi OPC-UA",
        lbl_endpoint: "URL Endpoint :",
        lbl_security: "Keamanan :",
        lbl_policy: "Kebijakan :",
        lbl_publish: "Publish (ms) :",
        lbl_sampling: "Sample (ms) :",
        lbl_opcua_user: "Username :",
        lbl_opcua_pass: "Password :",
        lbl_opcua_autoconnect: "Auto-Connect :",
        btn_opcua_save: "SIMPAN",
        btn_opcua_connect: "HUBUNGKAN",
        btn_opcua_disconnect: "PUTUSKAN",
        opcua_tags_title: "Daftar Tag Dipantau",
        btn_export_nodes: "Ekspor",
        btn_import_nodes: "Impor",
        confirm_import_nodes: "Impor {count} node dan mengganti seluruh daftar node OPC-UA saat ini?",
        nodes_exported_success: "Node berhasil diekspor",
        nodes_imported_success: "{count} node berhasil diimpor",
        nodes_import_invalid_file: "File JSON node tidak valid",
        nodes_import_failed: "Gagal mengimpor node",
        nodes_export_failed: "Konfigurasi node belum tersedia untuk diekspor",
        placeholder_tag_name: "Nama Tag",
        placeholder_scale: "Skala",
        placeholder_desc: "Deskripsi",
        btn_add_node: "Tambah Node",
        th_opc_no: "#",
        th_opc_nodeid: "Node ID",
        th_opc_name: "Nama",
        th_opc_machine: "Mesin",
        th_opc_signal: "Tipe Sinyal",
        th_opc_scale: "Skala",
        th_opc_desc: "Deskripsi",
        th_opc_live: "Nilai Live",
        th_opc_actions: "Tindakan",
        opt_global: "Global",
        no_nodes_configured: "Tidak ada node yang dikonfigurasi",

        // History View
        history_title: "Riwayat Timbangan",
        history_subtitle: "Log riwayat timbangan karung real-time pada seluruh carousel.",
        lbl_carousel: "Carousel",
        opt_all: "Semua",
        lbl_refresh_rate: "Kecepatan Refresh",
        opt_off: "Mati",
        btn_refresh: "Segarkan",
        th_time: "Waktu",
        th_carousel: "Carousel",
        th_product: "Produk",
        th_target: "Target",
        th_counter: "Hitungan",
        th_gross: "Bruto",
        th_nett: "Netto",
        th_status: "Status",
        loading: "Memuat...",
        lbl_rows: "Baris",
        btn_first_page: "Halaman pertama",
        btn_prev: "Sebelumnya",
        btn_next: "Selanjutnya",
        btn_last_page: "Halaman terakhir",
        no_records_found: "Data tidak ditemukan",
        no_records: "Tidak ada data",
        history_subtitle_text: "{count} data · {size} per halaman · {pages} halaman",
        history_rows_range: "Baris {start}–{end} dari {total}",

        // System Log View
        syslog_title: "Log Sistem",
        syslog_subtitle: "Peristiwa & diagnostik sistem real-time",
        lbl_level: "Tingkat",
        lbl_source: "Sumber",
        btn_clear: "Bersihkan",
        log_waiting: "Menunggu entri log...",

        // Activity Tracking & Audit Trail View
        audit_title: "Pelacakan Aktivitas & Audit Trail",
        audit_subtitle: "Log lengkap aktivitas pengguna, kontrol carousel, interlock, dan perubahan konfigurasi sistem.",
        btn_export_csv: "Ekspor CSV",
        audit_stat_total: "Total Aktivitas Hari Ini",
        audit_stat_auth: "Login & Otentikasi",
        audit_stat_control: "Kontrol Carousel / Reset",
        audit_stat_settings: "Perubahan Pengaturan",
        lbl_category: "Kategori",
        opt_all_categories: "Semua Kategori",
        opt_cat_auth: "Otentikasi (Login/Logout)",
        opt_cat_carousel: "Kontrol Carousel & Reset",
        opt_cat_settings: "Pengaturan & Interlock",
        opt_cat_usermgmt: "Manajemen Pengguna",
        opt_cat_opcua: "Tag OPC-UA & Koneksi",
        lbl_target_carousel: "Target Carousel",
        opt_all_targets: "Semua Target",
        lbl_start_date: "Dari Tanggal",
        lbl_end_date: "Sampai Tanggal",
        lbl_search: "Pencarian",
        placeholder_audit_search: "Cari user, action, detail...",
        placeholder_user_search: "Cari user, role...",
        btn_reset: "Atur Ulang",
        th_audit_time: "Waktu (WIB)",
        th_audit_user: "Pengguna",
        th_audit_category: "Kategori",
        th_audit_action: "Aktivitas",
        th_audit_target: "Target",
        th_audit_details: "Rincian / Perubahan Nilai",
        th_audit_ip: "Alamat IP",
        loading_audit: "Memuat data audit trail...",
        no_audit_activities: "Tidak ada aktivitas yang sesuai dengan filter",
        audit_load_failed: "Koneksi gagal saat memuat log",
        page_x_of_y: "Halaman {curr} dari {total}",
        showing_rows_range: "Menampilkan {start}–{end} dari {total} total log",

        // Alarm Ticker & Footer
        title_alarm_ack: "Akui alarm (bersihkan buffer PERINGATAN/ERROR)",
        footer_sensors: "SENSOR",
        btn_footer_reset: "RESET",

        // Modals
        modal_control_title: "Kontrol Carousel",
        modal_current_status: "Status Saat Ini:",
        btn_run: "JALANKAN",
        btn_pause: "JEDA",
        btn_stop: "BERHENTI",
        modal_add_user_title: "Tambah Pengguna Baru",
        lbl_username: "Username",
        lbl_password: "Password",
        lbl_role: "Peran (Role)",
        btn_create_user: "Buat Pengguna",
        modal_edit_user_title: "Ubah Pengguna",
        lbl_new_password: "Password Baru (kosongkan jika tidak diubah)",
        btn_save_changes: "Simpan Perubahan",
        opcua_modal_title: "Ubah Tag OPC-UA",
        opcua_modal_subtitle: "Perbarui pemetaan node dan metadata tag.",
        lbl_node_index: "Indeks Node",
        lbl_node_name: "Nama Tag",
        lbl_node_id: "Node ID",
        lbl_node_machine: "Mesin",
        lbl_node_signal: "Tipe Sinyal",
        lbl_scale_factor: "Faktor Skala",
        lbl_description: "Deskripsi",
        opcua_edit_tip: "Tip: tekan <kbd>Esc</kbd> untuk menutup jendela ini.",
        btn_cancel: "Batal",
        cfg_confirm_title: "Konfirmasi Perubahan",
        cfg_confirm_subtitle: "Verifikasi password untuk otorisasi",
        cfg_confirm_default_desc: "Apakah Anda yakin ingin menyimpan perubahan ini?",
        lbl_user_password: "Password Pengguna",
        lbl_user_prefix: "User:",
        placeholder_password: "Masukkan password Anda...",
        msg_wrong_password: "Password salah!",
        btn_confirm_save: "Konfirmasi & Simpan",
        verifying: "Memverifikasi...",
        enter_password_prompt: "Silakan masukkan password untuk konfirmasi!"
    },
    en: {
        // General & Header
        sriboga_tagline: "PIONEER IN FLOUR INNOVATION",
        header_title: "WEIGHING DASHBOARD",
        theme_toggle_title: "Switch theme",
        nav_home: "Home",
        nav_config: "Config",
        nav_users: "Users",
        nav_opcua: "OPC",
        nav_history: "History",
        nav_logs: "Logs",
        nav_audit: "Audit Trail",
        nav_logout: "Logout",
        btn_signin: "Sign In",

        // Home View / Carousel Cards
        updating_data: "Updating Data...",
        carousel_n: "Carousel {n}",
        card_product_id: "Product ID",
        card_packing_order: "Packing Order",
        card_package: "Package",
        card_tolerance: "Tolerance",
        card_pack_weight: "Pack Weight",
        card_gross_weight: "Gross Weight",
        card_counter_pcs: "Counter: {n} Pcs",
        card_target_pcs: "Target: {n} Pcs",
        card_stats_tooltip: "Statistics based on the last 1 hour of production",
        card_min_1h: "Min (1h)",
        card_nett: "Nett",
        card_avg_1h: "Avg (1h)",
        card_btn_update: "Update Data",
        card_waiting_order: "Waiting for Packing Order",
        card_md_status: "Interlock",

        // Config View
        config_title: "System Configuration",
        config_subtitle: "Underweight interlock tolerances and SQL database server connection settings",
        interlock_panel_title: "Weight Limits & Interlock Metal Detector",
        lower_limit_label: "Threshold Lower Limit :",
        upper_limit_label: "Threshold Upper Limit :",
        sql_panel_title: "SQL Server Setting",
        checking: "CHECKING...",
        lbl_server: "Server :",
        lbl_port: "Port :",
        lbl_uid: "UID :",
        lbl_pass: "PASS :",
        lbl_db: "Database :",
        lbl_table_zero: "Table Zeroing :",
        lbl_table_weight: "Table Weight :",
        lbl_table_preset: "Table Preset Data :",
        lbl_auto_reconnect: "Auto-Reconnect :",
        btn_save_settings: "SAVE SETTINGS",
        dev_min_label: "Dev.Min :",
        normal_label: "Normal",
        interlock_label: "Interlock",
        admin_only_interlock: "Only admins can change interlock configuration.",
        admin_only_deviation: "Only admins can change deviation limit.",
        admin_only_sql: "Only admins can change SQL Server settings.",
        confirm_interlock_title: "Confirm Carousel {n} Interlock",
        confirm_interlock_under_title: "Confirm Lower Limit Interlock CR{n}",
        confirm_interlock_under_desc: "Are you sure you want to change Lower Limit (Underweight) Interlock for <strong>Carousel {n}</strong> to {status}?",
        confirm_interlock_over_title: "Confirm Upper Limit Interlock CR{n}",
        confirm_interlock_over_desc: "Are you sure you want to change Upper Limit (Overweight) Interlock for <strong>Carousel {n}</strong> to {status}?",
        confirm_deviation_min_title: "Confirm Lower Limit Deviation",
        confirm_deviation_min_desc: "Are you sure you want to change Lower Limit deviation for <strong>Carousel {n}</strong> from <strong>{oldVal} Kg</strong> to <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_deviation_max_title: "Confirm Upper Limit Deviation",
        confirm_deviation_max_desc: "Are you sure you want to change Upper Limit deviation for <strong>Carousel {n}</strong> from <strong>{oldVal} Kg</strong> to <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_interlock_desc: "Are you sure you want to change Underweight Interlock status for <strong>Carousel {n}</strong> to {status}?",
        confirm_deviation_title: "Confirm Minimum Deviation",
        confirm_deviation_desc: "Are you sure you want to change minimum deviation limit for <strong>Carousel {n}</strong> from <strong>{oldVal} Kg</strong> to <strong style=\"color:#2563eb;\">{newVal} Kg</strong>?",
        confirm_sql_title: "Confirm SQL Server Settings",
        confirm_sql_desc: "Are you sure you want to save <strong>SQL Server</strong> database configuration?",
        confirm_sql_diff_title: "Are you sure you want to save the following <strong>SQL Server</strong> configuration changes?",
        status_on: "ACTIVE (ON)",
        status_off: "INACTIVE (OFF)",

        // Users View
        users_title: "User Management",
        users_subtitle: "Manage user accounts, authorization roles, and system credentials",
        btn_add_user: "Add User",
        th_user_id: "ID",
        th_user_name: "Username",
        th_user_roles: "Roles",
        th_user_actions: "Actions",
        btn_edit: "Edit",
        btn_delete: "Delete",
        confirm_delete_user: "Are you sure you want to delete this user?",
        user_updated_success: "User updated successfully",
        user_created_success: "User created successfully",

        // OPC-UA View
        opcua_title: "OPC-UA Interface",
        opcua_subtitle: "Industrial PLC communication endpoint, security profile, and live tag monitoring",
        opcua_conn_title: "OPC-UA Connection",
        lbl_endpoint: "Endpoint URL :",
        lbl_security: "Security :",
        lbl_policy: "Policy :",
        lbl_publish: "Publish (ms) :",
        lbl_sampling: "Sample (ms) :",
        lbl_opcua_user: "Username :",
        lbl_opcua_pass: "Password :",
        lbl_opcua_autoconnect: "Auto-Connect :",
        btn_opcua_save: "SAVE",
        btn_opcua_connect: "CONNECT",
        btn_opcua_disconnect: "DISCONNECT",
        opcua_tags_title: "Monitored Nodes",
        btn_export_nodes: "Export",
        btn_import_nodes: "Import",
        confirm_import_nodes: "Import {count} nodes and replace the entire current OPC-UA node list?",
        nodes_exported_success: "Nodes exported successfully",
        nodes_imported_success: "{count} nodes imported successfully",
        nodes_import_invalid_file: "Invalid node JSON file",
        nodes_import_failed: "Failed to import nodes",
        nodes_export_failed: "Node configuration is not available to export",
        placeholder_tag_name: "Tag Name",
        placeholder_scale: "Scale",
        placeholder_desc: "Description",
        btn_add_node: "Add Node",
        th_opc_no: "#",
        th_opc_nodeid: "Node ID",
        th_opc_name: "Name",
        th_opc_machine: "Machine",
        th_opc_signal: "Signal Type",
        th_opc_scale: "Scale",
        th_opc_desc: "Description",
        th_opc_live: "Live Value",
        th_opc_actions: "Actions",
        opt_global: "Global",
        no_nodes_configured: "No nodes configured",

        // History View
        history_title: "Weight History",
        history_subtitle: "Real-time bag weighing logs and historical records across all carousels.",
        lbl_carousel: "Carousel",
        opt_all: "All",
        lbl_refresh_rate: "Refresh Rate",
        opt_off: "Off",
        btn_refresh: "Refresh",
        th_time: "Time",
        th_carousel: "Carousel",
        th_product: "Product",
        th_target: "Target",
        th_counter: "Counter",
        th_gross: "Gross",
        th_nett: "Nett",
        th_status: "Status",
        loading: "Loading...",
        lbl_rows: "Rows",
        btn_first_page: "First page",
        btn_prev: "Prev",
        btn_next: "Next",
        btn_last_page: "Last page",
        no_records_found: "No records found",
        no_records: "No records",
        history_subtitle_text: "{count} record(s) · {size} per page · {pages} page(s)",
        history_rows_range: "Rows {start}–{end} of {total}",

        // System Log View
        syslog_title: "System Log",
        syslog_subtitle: "Real-time system events & diagnostics",
        lbl_level: "Level",
        lbl_source: "Source",
        btn_clear: "Clear",
        log_waiting: "Waiting for log entries...",

        // Activity Tracking & Audit Trail View
        audit_title: "Activity Tracking & Audit Trail",
        audit_subtitle: "Comprehensive log of user activities, carousel controls, interlocks, and system configuration changes.",
        btn_export_csv: "Export CSV",
        audit_stat_total: "Total Activities Today",
        audit_stat_auth: "Login & Authentication",
        audit_stat_control: "Carousel Control / Reset",
        audit_stat_settings: "Settings Changes",
        lbl_category: "Category",
        opt_all_categories: "All Categories",
        opt_cat_auth: "Authentication (Login/Logout)",
        opt_cat_carousel: "Carousel Control & Reset",
        opt_cat_settings: "Settings & Interlock",
        opt_cat_usermgmt: "User Management",
        opt_cat_opcua: "OPC-UA Tag & Connection",
        lbl_target_carousel: "Target Carousel",
        opt_all_targets: "All Targets",
        lbl_start_date: "From Date",
        lbl_end_date: "To Date",
        lbl_search: "Search",
        placeholder_audit_search: "Search user, action, details...",
        placeholder_user_search: "Search user, role...",
        btn_reset: "Reset",
        th_audit_time: "Time (WIB)",
        th_audit_user: "User",
        th_audit_category: "Category",
        th_audit_action: "Action",
        th_audit_target: "Target",
        th_audit_details: "Details / Value Changes",
        th_audit_ip: "IP Address",
        loading_audit: "Loading audit trail data...",
        no_audit_activities: "No activities match the filter",
        audit_load_failed: "Connection failed while loading logs",
        page_x_of_y: "Page {curr} of {total}",
        showing_rows_range: "Showing {start}–{end} of {total} total logs",

        // Alarm Ticker & Footer
        title_alarm_ack: "Acknowledge alarm (clear WARN/ERROR buffer)",
        footer_sensors: "SENSORS",
        btn_footer_reset: "RESET",

        // Modals
        modal_control_title: "Carousel Control",
        modal_current_status: "Current Status:",
        btn_run: "RUN",
        btn_pause: "PAUSE",
        btn_stop: "STOP",
        modal_add_user_title: "Add New User",
        lbl_username: "Username",
        lbl_password: "Password",
        lbl_role: "Role",
        btn_create_user: "Create User",
        modal_edit_user_title: "Edit User",
        lbl_new_password: "New Password (leave blank to keep current)",
        btn_save_changes: "Save Changes",
        opcua_modal_title: "Edit OPC-UA Tag",
        opcua_modal_subtitle: "Update node mapping and tag metadata.",
        lbl_node_index: "Node Index",
        lbl_node_name: "Tag Name",
        lbl_node_id: "Node ID",
        lbl_node_machine: "Machine",
        lbl_node_signal: "Signal Type",
        lbl_scale_factor: "Scale Factor",
        lbl_description: "Description",
        opcua_edit_tip: "Tip: press <kbd>Esc</kbd> to close this window.",
        btn_cancel: "Cancel",
        cfg_confirm_title: "Confirm Changes",
        cfg_confirm_subtitle: "Password verification for authorization",
        cfg_confirm_default_desc: "Are you sure you want to save these changes?",
        lbl_user_password: "User Password",
        lbl_user_prefix: "User:",
        placeholder_password: "Enter your password...",
        msg_wrong_password: "Incorrect password!",
        btn_confirm_save: "Confirm & Save",
        verifying: "Verifying...",
        enter_password_prompt: "Please enter your password to confirm!"
    }
};

let currentLang = localStorage.getItem('scada_lang') || 'id';

function t(key, params = {}) {
    const langDict = translations[currentLang] || translations.id;
    let text = (langDict && langDict[key] !== undefined)
        ? langDict[key]
        : ((translations.id && translations.id[key] !== undefined) ? translations.id[key] : key);
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\{${k}\}`, 'g'), v);
    }
    return text;
}

function setLanguage(lang) {
    if (lang !== 'id' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem('scada_lang', lang);
    applyTranslations();
}
window.setLanguage = setLanguage;
window.t = t;

function initLanguage() {
    currentLang = localStorage.getItem('scada_lang') || 'id';
    applyTranslations();
}

function applyTranslations() {
    // 1. Update Lang Switcher Buttons active state
    const btnId = document.getElementById('lang-btn-id');
    const btnEn = document.getElementById('lang-btn-en');
    if (btnId) btnId.classList.toggle('active', currentLang === 'id');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');

    // 2. Update document lang
    document.documentElement.lang = currentLang;

    // 3. Translate data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && (translations[currentLang]?.[key] !== undefined || translations.id?.[key] !== undefined)) {
            el.innerHTML = t(key);
        }
    });

    // 4. Translate data-i18n-placeholder elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && (translations[currentLang]?.[key] !== undefined || translations.id?.[key] !== undefined)) {
            el.placeholder = t(key);
        }
    });

    // 5. Translate data-i18n-title elements
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key && (translations[currentLang]?.[key] !== undefined || translations.id?.[key] !== undefined)) {
            el.title = t(key);
        }
    });

    // 6. Update username in sidebar
    if (currentUser && currentUser.username) {
        const userDisplay = document.getElementById('current-user-display');
        if (userDisplay) {
            userDisplay.innerText = currentUser.username;
        }
    }

    // 7. Re-render carousel cards if data is available
    if (window.lastCarouselsData) {
        renderCarousels(window.lastCarouselsData);
    }

    // 8. Re-render settings if on config view
    if (currentView === 'config' && window.appSettings) {
        renderSettings();
    }

    // 9. Re-render users if on users view
    if (currentView === 'users' && window.lastUsersData) {
        renderUsers(window.lastUsersData);
    }

    // 10. Re-render OPC nodes if on opcua view
    if (currentView === 'opcua' && window.opcuaConfig) {
        renderOpcUaNodes();
    }

    // 11. Re-render history pagination if on history view
    if (currentView === 'history') {
        updateHistorySubtitle();
        updateHistoryPaginationUi();
    }

    // 12. Re-render audit pagination if on audit view
    if (currentView === 'audit') {
        updateAuditPaginationUI();
    }
}

let socket = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initLanguage();
    checkAuth();
    startClock();
    loadTheme();
    setupLoginEnterKey();
});


// --- Theme Toggle ---
function loadTheme() {
    const saved = localStorage.getItem('scada_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('theme-icon');
    if (saved === 'light') {
        icon.className = 'bx bxs-sun';
    } else {
        icon.className = 'bx bxs-moon';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('scada_theme', next);
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (next === 'light') {
            icon.className = 'bx bxs-sun';
        } else {
            icon.className = 'bx bxs-moon';
        }
    }
}

// --- Mobile Card Switcher ---
let activeCard = 1;

function showCard(num) {
    activeCard = num;
    const cards = document.querySelectorAll('#view-home .carousel-col');
    cards.forEach((card, idx) => {
        card.classList.toggle('mobile-active', idx === num - 1);
    });
    // Update picker buttons
    document.querySelectorAll('.picker-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === num - 1);
    });
}

function activateMobileCard() {
    if (window.innerWidth <= 768) {
        showCard(activeCard);
    }
}

function startClock() {
    const updateTime = () => {
        const now = new Date();
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (timeEl) timeEl.innerText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const locale = currentLang === 'id' ? 'id-ID' : 'en-GB';
        if (dateEl) dateEl.innerText = now.toLocaleDateString(locale, options);
    };
    updateTime();
    setInterval(updateTime, 1000);
}

function checkAuth() {
    const user = localStorage.getItem('scada_user');
    if (user) {
        try {
            currentUser = JSON.parse(user);
            // Validate session integrity (fresh login required for roles)
            if (!currentUser.roles || !currentUser.accessToken) {
                console.log("Invalid session detected, forcing logout");
                handleLogout();
                return;
            }
            initApp();
        } catch (e) {
            handleLogout();
        }
    } else {
        document.getElementById('login-view').style.display = 'flex';
    }
}

function setupLoginEnterKey() {
    const inputs = [document.getElementById('username'), document.getElementById('password')];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    handleLogin();
                }
            });
        }
    });
}

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    if (!username || !password) {
        errorMsg.innerText = "Please enter username and password";
        return;
    }

    try {
        const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = data; // Contains accessToken and roles
            localStorage.setItem('scada_user', JSON.stringify(currentUser));
            initApp();
        } else {
            errorMsg.innerText = data.message || "Login failed";
        }
    } catch (e) {
        errorMsg.innerText = "Network error";
        console.error(e);
    }
}

async function handleLogout() {
    try {
        if (currentUser && currentUser.accessToken) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': currentUser.accessToken
                },
                body: JSON.stringify({ username: currentUser.username })
            });
        }
    } catch (e) {
        console.error("Logout notification error:", e);
    }
    localStorage.removeItem('scada_user');
    location.reload();
}

function initApp() {
    document.getElementById('login-view').style.display = 'none';
    document.querySelector('.app-wrapper').style.display = 'flex';

    // Apply role-based nav menu visibility immediately on login (and on reload via checkAuth)
    updateNavVisibility();

    if (currentUser && currentUser.username) {
        document.getElementById('current-user-display').innerText = currentUser.username;
    }

    // Default to offline state before data is received
    const offlineState = {};
    for (let i = 1; i <= 5; i++) offlineState[i] = { id: i, state: 'OFFLINE', data: null };
    renderCarousels(offlineState);

    // Connect Socket with authentication
    socket = io({
        auth: {
            token: currentUser.accessToken
        }
    });

    socket.on('init', (data) => {
        console.log("Init Data", data);
        renderCarousels(data);
    });

    socket.on('carousel-update', (data) => {
        renderCarousels(data);
    });

    socket.on('config-loading', (loading) => {
        const overlays = document.querySelectorAll('.card-loading-overlay');
        overlays.forEach(overlay => {
            if (loading) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        });
    });

    // OPC-UA events
    socket.on('opcua-status', (status) => {
        updateOpcUaStatusUI(status);
        updateFooterConnections({ opcStatus: status });
    });
    socket.on('opcua-value', (data) => updateOpcUaLiveValue(data));
    socket.on('scada-alert', (alertData) => handleScadaAlert(alertData));

    // SQL status via Socket.IO (real-time push instead of polling)
    socket.on('sql-status', (status) => {
        updateSqlStatusUI(status);
    });

    // System log real-time
    socket.on('system-log', (entry) => {
        appendLogEntry(entry);
        addAlarmEntry(entry);
    });

    // Real-time audit log listener
    socket.on('new-audit-log', (entry) => {
        handleRealtimeAuditLog(entry);
    });

    // Load initial settings
    loadSettings();
    loadAlarmTicker();

    // Initial SQL status load - wait a bit for socket to be ready
    setTimeout(() => pollSqlStatus(), 500);
    // Periodic SQL status check (fallback if socket fails)
    setInterval(pollSqlStatus, 30000); // Every 30s

    // Initial OPC Status Sync
    if (currentUser && currentUser.accessToken) {
        fetch('/api/opcua/status', {
            headers: { 'x-access-token': currentUser.accessToken }
        })
            .then(res => res.json())
            .then(status => {
                if (status) {
                    updateOpcUaStatusUI(status);
                    updateFooterConnections({ opcStatus: status });
                }
            })
            .catch(err => console.error("Initial OPC status fetch failed", err));
    }
}

// --- Footer Logic ---

function updateFooterSensors(carousels) {
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`sensor-${i}`);
        if (!el) continue;

        const led = el.querySelector('.led');
        if (!led) continue;

        // Reset classes
        led.className = 'led';

        if (!lastOpcStatus) {
            led.classList.add('status-neutral'); // Gray: OPC UA Offline
            continue;
        }

        const liveVal = findOpcUaLiveBySignal('PRODUCT_SENSOR', i);
        if (liveVal) {
            if (!liveVal.statusCode || !liveVal.statusCode.toString().startsWith('Good')) {
                led.classList.add('status-neutral'); // Gray: bad sensor health
            } else if (liveVal.value === true || liveVal.value === 1 || liveVal.value === 'true') {
                led.classList.add('status-good'); // Green: active (bag detected)
            } else {
                led.classList.add('status-warning'); // Yellow: connected but inactive
            }
        } else {
            // Check if carousel sensorStatus is set as fallback
            const carousel = carousels ? carousels[i] : null;
            if (carousel && carousel.data && carousel.data.sensorStatus) {
                led.classList.add('status-good');
            } else {
                led.classList.add('status-warning'); // Yellow: connected (default when no liveVal yet but connected)
            }
        }
    }
}

let lastSqlStatus = false;
let lastOpcStatus = false;
let lastSqlStatusData = null;

// Reusable function to update SQL status UI (both footer and badge)
function updateSqlStatusUI(status) {
    if (!status) return;
    
    // Store last status
    lastSqlStatusData = status;
    
    // Update Footer
    updateFooterConnections({ sql: status.connected });
    
    // Update Badge (if exists in DOM)
    const badge = document.getElementById('sql-status-badge');
    if (badge) {
        if (status.connected) {
            badge.className = 'status-badge connected';
            badge.innerText = 'CONNECTED';
            badge.title = status.database ? `Connected to ${status.database} on ${status.server}` : 'Connected';
        } else {
            badge.className = 'status-badge disconnected';
            badge.innerText = 'DISCONNECTED';
            badge.title = 'Connection Failed';
        }
    }
}

function updateFooterConnections(statusUpdate) {
    if (!statusUpdate) return;

    // Update local state - SQL
    if (statusUpdate.sql !== undefined) {
        lastSqlStatus = !!statusUpdate.sql;
    }

    // Update local state - OPC
    if (statusUpdate.opcStatus !== undefined) {
        lastOpcStatus = !!statusUpdate.opcStatus.connected;
    } else if (statusUpdate.opcConnected !== undefined) {
        lastOpcStatus = !!statusUpdate.opcConnected;
    }

    // Update UI - SQL (with blinking for disconnected)
    const sqlIcon = document.getElementById('conn-sql');
    if (sqlIcon) {
        sqlIcon.className = 'conn-item ' + (lastSqlStatus ? 'status-good' : 'status-bad blink-danger');
        const label = sqlIcon.querySelector('.conn-label');
        if (label) label.innerText = lastSqlStatus ? 'Connected' : 'Disconnected';
    }

    // Update UI - OPC (with blinking for disconnected)
    const opcIcon = document.getElementById('conn-opc');
    if (opcIcon) {
        opcIcon.className = 'conn-item ' + (lastOpcStatus ? 'status-good' : 'status-bad blink-danger');
        const label = opcIcon.querySelector('.conn-label');
        if (label) label.innerText = lastOpcStatus ? 'Connected' : 'Disconnected';
    }

    // Refresh sensor LEDs on connection state change
    updateFooterSensors();
}

let currentView = 'home';
let appSettings = {};
let historyIntervalId = null;

function navigate(view) {
    if (historyIntervalId) {
        clearInterval(historyIntervalId);
        historyIntervalId = null;
    }
    currentView = view;
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    // Show/hide card picker
    const picker = document.getElementById('card-picker');
    const isMobile = window.innerWidth <= 768;
    if (picker) picker.style.display = view === 'home' ? '' : 'none';

    // Show selected
    if (view === 'home') {
        document.getElementById('view-home').style.display = isMobile ? 'flex' : 'grid';
    } else if (view === 'config') {
        // Admin: full access | User: read-only view
        if (!currentUser || !currentUser.roles || (!currentUser.roles.includes('ROLE_ADMIN') && !currentUser.roles.includes('ROLE_USER'))) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-config').style.display = 'flex';
        loadSettings();
        // Refresh SQL status when opening config page
        setTimeout(() => {
            if (lastSqlStatusData) {
                updateSqlStatusUI(lastSqlStatusData);
            } else {
                pollSqlStatus();
            }
        }, 100);
    } else if (view === 'users') {
        // Role Check
        if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
            alert("Access Denied: Admin privileges required.");
            navigate('home');
            return;
        }
        document.getElementById('view-users').style.display = 'flex';
        loadUsers();
    } else if (view === 'opcua') {
        if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
            alert("Access Denied: Admin privileges required.");
            navigate('home');
            return;
        }
        document.getElementById('view-opcua').style.display = 'flex';
        document.getElementById('view-opcua').style.display = 'flex';
        loadOpcUaConfig();
    } else if (view === 'history') {
        // Allow Admin AND User (maybe guest too? Let's say Admin/User for now)
        if (!currentUser || !currentUser.roles) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-history').style.display = 'flex';
        loadHistory();

        // Start history auto-refresh interval based on dropdown selection
        onHistoryRefreshChange();
    } else if (view === 'logs') {
        // Allow Admin and User
        if (!currentUser || !currentUser.roles || (!currentUser.roles.includes('ROLE_ADMIN') && !currentUser.roles.includes('ROLE_USER'))) {
            alert("Access Denied.");
            navigate('home');
            return;
        }
        document.getElementById('view-logs').style.display = 'flex';
        loadLogs();
    } else if (view === 'audit') {
        // Role Check: Admin privileges required
        if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
            alert("Access Denied: Admin privileges required.");
            navigate('home');
            return;
        }
        document.getElementById('view-audit').style.display = 'flex';
        loadAuditLogs(1);
        loadAuditStats();
    }

    // Apply role-based visibility to nav buttons (also called on login via initApp)
        updateNavVisibility();

        // Update Nav Active State
        document.querySelectorAll('.nav-btn').forEach((btn) => {
            btn.classList.remove('active');
            const targetView = btn.getAttribute('data-view');
            if (targetView === view) btn.classList.add('active');
        });
    }

    // Hide/show nav buttons based on the logged-in user's roles.
    // Extracted from navigate() so it also runs once on login (fixes icons all showing
    // for guest/operator until the user clicks a nav item).
    function updateNavVisibility() {
        const isGuest = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_GUEST');
        const isUser = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_USER');
        const isAdmin = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_ADMIN');

        document.querySelectorAll('.nav-btn').forEach((btn) => {
            const viewType = btn.getAttribute('data-view');
            if (viewType === 'config') {
                btn.style.display = (isAdmin || isUser) ? 'flex' : 'none';
            } else if (viewType === 'opcua') {
                btn.style.display = (isAdmin) ? 'flex' : 'none';
            } else if (viewType === 'history') {
                btn.style.display = (isAdmin || isUser || isGuest) ? 'flex' : 'none';
            } else if (viewType === 'logs') {
                btn.style.display = (isAdmin || isUser) ? 'flex' : 'none';
            } else if (viewType === 'audit') {
                btn.style.display = (isAdmin) ? 'flex' : 'none';
            } else if (viewType === 'users') {
                btn.style.display = (isAdmin) ? 'flex' : 'none';
            } else {
                btn.style.display = 'flex'; // Home
            }
        });
    }


// --- Settings Logic ---
async function loadSettings() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/settings', {
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            appSettings = await res.json();
            renderSettings();
            if (window.lastCarouselsData) {
                renderCarousels(window.lastCarouselsData);
            }
        } else if (res.status === 403) {
            // Non-admin users: silently skip. The settings view itself is
            // already hidden for them, so no alert needed.
            console.warn('[SCADA] Settings access denied (non-admin user)');
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

function renderSettings() {
    const isAdmin = currentUser && currentUser.roles && currentUser.roles.includes('ROLE_ADMIN');

    // SQL Inputs
    document.getElementById('cfg-server').value = appSettings.sql_server || '';
    document.getElementById('cfg-port').value = appSettings.sql_port || '';
    document.getElementById('cfg-uid').value = appSettings.sql_uid || '';
    document.getElementById('cfg-pass').value = appSettings.sql_pass || '';
    document.getElementById('cfg-db').value = appSettings.sql_db || '';
    document.getElementById('cfg-table-zero').value = appSettings.table_zeroing || '';
    document.getElementById('cfg-table-weight').value = appSettings.table_weight || '';
    document.getElementById('cfg-table-main').value = appSettings.table_main || '';

    // Set readonly on SQL inputs for non-admin
    const sqlInputs = ['cfg-server','cfg-port','cfg-uid','cfg-pass','cfg-db','cfg-table-zero','cfg-table-weight','cfg-table-main'];
    sqlInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isAdmin) {
                el.removeAttribute('readonly');
                el.style.background = '';
                el.style.color = '';
                el.style.cursor = '';
            } else {
                el.setAttribute('readonly', 'readonly');
                el.style.background = '#2a2a35';
                el.style.color = '#777';
                el.style.cursor = 'not-allowed';
            }
        }
    });

    // SQL Auto-Reconnect checkbox
    const sqlAutoReconnect = document.getElementById('cfg-sql-auto-reconnect');
    if (sqlAutoReconnect) {
        sqlAutoReconnect.checked = !!appSettings.sql_auto_reconnect;
        sqlAutoReconnect.disabled = !isAdmin;
    }

    // Hide Save button for non-admin
    const saveBtn = document.querySelector('#view-config .btn-save');
    if (saveBtn) {
        saveBtn.style.display = isAdmin ? '' : 'none';
    }

    // Interlocks (Lower Limit & Upper Limit per Carousel)
    const container = document.getElementById('interlock-settings');
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `carousel${i}`;
        const isUnderInterlocked = (appSettings.interlocksUnder && appSettings.interlocksUnder[key] !== undefined)
            ? !!appSettings.interlocksUnder[key]
            : (appSettings.interlocks ? !!appSettings.interlocks[key] : false);

        const isOverInterlocked = (appSettings.interlocksOver && appSettings.interlocksOver[key] !== undefined)
            ? !!appSettings.interlocksOver[key]
            : false;

        const devMin = (appSettings.deviationThresholdsMin && appSettings.deviationThresholdsMin[key] !== undefined)
            ? appSettings.deviationThresholdsMin[key]
            : ((appSettings.deviationThresholds && appSettings.deviationThresholds[key] !== undefined)
                ? appSettings.deviationThresholds[key]
                : 0.05);

        const devMax = (appSettings.deviationThresholdsMax && appSettings.deviationThresholdsMax[key] !== undefined)
            ? appSettings.deviationThresholdsMax[key]
            : 0.05;

        const thresholdStyle = isAdmin
            ? 'width:68px; height:26px; box-sizing:border-box; padding:2px 6px; font-size:0.8rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--bg-input); color:var(--text-primary); text-align:right; vertical-align:middle;'
            : 'width:68px; height:26px; box-sizing:border-box; padding:2px 6px; font-size:0.8rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--bg-input); color:var(--text-muted); cursor:not-allowed; opacity:0.7; text-align:right; vertical-align:middle;';

        const row = document.createElement('div');
        row.className = 'interlock-row';
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-subtle); gap:16px;';
        row.innerHTML = `
            <div style="min-width:95px; display:flex; align-items:center;">
                <span style="font-weight:bold; font-size:0.95rem; line-height:1;">${t('carousel_n', { n: i })}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; justify-content:center; flex:1;">
                <!-- Lower Limit (Underweight) -->
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; height:26px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; min-width:138px; text-align:right; line-height:26px;">${t('lower_limit_label') || 'Threshold Lower Limit :'}</span>
                    <input type="number"
                           id="dev-min-${key}"
                           value="${devMin}"
                           step="0.01"
                           min="0"
                           style="${thresholdStyle}"
                           onchange="promptUpdateDeviation('${key}', 'min', this)"
                           ${isAdmin ? '' : 'readonly'}>
                    <span style="font-size:0.7rem; color:#888; line-height:26px;">Kg</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px; line-height:26px;">${t('normal_label')}</span>
                    <div style="display:inline-flex; align-items:center; justify-content:center; height:26px;">
                        <label class="switch" style="transform:scale(0.82); transform-origin:center center; margin:0 -2px;">
                            <input type="checkbox" id="interlock-switch-under-${key}" onchange="promptToggleInterlock('${key}', 'under', this)" ${isUnderInterlocked ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <span style="font-size:0.75rem; font-weight:600; min-width:50px; line-height:26px; color:${isUnderInterlocked ? '#059669' : 'inherit'};">${t('interlock_label')}</span>
                </div>
                <!-- Upper Limit (Overweight) -->
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; height:26px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; min-width:138px; text-align:right; line-height:26px;">${t('upper_limit_label') || 'Threshold Upper Limit :'}</span>
                    <input type="number"
                           id="dev-max-${key}"
                           value="${devMax}"
                           step="0.01"
                           min="0"
                           style="${thresholdStyle}"
                           onchange="promptUpdateDeviation('${key}', 'max', this)"
                           ${isAdmin ? '' : 'readonly'}>
                    <span style="font-size:0.7rem; color:#888; line-height:26px;">Kg</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px; line-height:26px;">${t('normal_label')}</span>
                    <div style="display:inline-flex; align-items:center; justify-content:center; height:26px;">
                        <label class="switch" style="transform:scale(0.82); transform-origin:center center; margin:0 -2px;">
                            <input type="checkbox" id="interlock-switch-over-${key}" onchange="promptToggleInterlock('${key}', 'over', this)" ${isOverInterlocked ? 'checked' : ''} ${isAdmin ? '' : 'disabled'}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <span style="font-size:0.75rem; font-weight:600; min-width:50px; line-height:26px; color:${isOverInterlocked ? '#059669' : 'inherit'};">${t('interlock_label')}</span>
                </div>
            </div>
        `;
        container.appendChild(row);
    }
}

// ==========================================================================
// CONFIG CHANGE CONFIRMATION WITH PASSWORD
// ==========================================================================
let pendingConfigAction = null;

function openConfigConfirmModal(title, desc, revertFn, applyFn) {
    pendingConfigAction = {
        title,
        desc,
        revert: revertFn,
        apply: applyFn
    };

    const modal = document.getElementById('config-confirm-modal');
    const titleEl = document.getElementById('config-confirm-title');
    const descEl = document.getElementById('config-confirm-desc');
    const userEl = document.getElementById('config-confirm-user');
    const pwdInput = document.getElementById('config-confirm-password');
    const errorEl = document.getElementById('config-confirm-error');
    const submitBtn = document.getElementById('btn-config-confirm-submit');

    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerHTML = desc;
    if (userEl) userEl.innerText = (currentUser && currentUser.username) ? currentUser.username : 'admin';
    if (pwdInput) pwdInput.value = '';
    if (errorEl) errorEl.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class='bx bx-check-shield'></i> ${t('btn_confirm_save')}`;
    }

    if (modal) modal.style.display = 'flex';
    setTimeout(() => {
        if (pwdInput) pwdInput.focus();
    }, 100);
}

function closeConfigConfirmModal() {
    const modal = document.getElementById('config-confirm-modal');
    if (modal) modal.style.display = 'none';

    if (pendingConfigAction && typeof pendingConfigAction.revert === 'function') {
        try {
            pendingConfigAction.revert();
        } catch (e) {
            console.error("Revert config error:", e);
        }
    }
    pendingConfigAction = null;
}

async function submitConfigConfirm() {
    if (!pendingConfigAction) return;

    const pwdInput = document.getElementById('config-confirm-password');
    const errorEl = document.getElementById('config-confirm-error');
    const errorMsg = document.getElementById('config-confirm-error-msg');
    const submitBtn = document.getElementById('btn-config-confirm-submit');

    const password = pwdInput ? pwdInput.value : '';
    if (!password) {
        if (errorEl && errorMsg) {
            errorMsg.innerText = t("enter_password_prompt");
            errorEl.style.display = 'block';
        }
        if (pwdInput) pwdInput.focus();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> ${t('verifying')}`;
    }
    if (errorEl) errorEl.style.display = 'none';

    try {
        const action = pendingConfigAction;
        const success = await action.apply(password);
        if (success) {
            pendingConfigAction = null;
            const modal = document.getElementById('config-confirm-modal');
            if (modal) modal.style.display = 'none';
        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class='bx bx-check-shield'></i> ${t('btn_confirm_save')}`;
            }
        }
    } catch (err) {
        console.error("submitConfigConfirm error:", err);
        if (errorEl && errorMsg) {
            errorMsg.innerText = err.message || "Terjadi kesalahan saat menyimpan.";
            errorEl.style.display = 'block';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class='bx bx-check-shield'></i> ${t('btn_confirm_save')}`;
        }
    }
}

function promptToggleInterlock(key, type, checkboxEl) {
    // Fallback if called without type
    if (typeof type === 'object' && !checkboxEl) {
        checkboxEl = type;
        type = 'under';
    }

    if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
        alert(t("admin_only_interlock"));
        checkboxEl.checked = !checkboxEl.checked;
        return;
    }

    const carouselNum = key.replace('carousel', '');
    const isUnder = type === 'under';
    const settingsMap = isUnder ? (appSettings.interlocksUnder || appSettings.interlocks || {}) : (appSettings.interlocksOver || {});
    const oldVal = !!settingsMap[key];
    const newVal = checkboxEl.checked;

    if (oldVal === newVal) return;

    const title = isUnder
        ? (t("confirm_interlock_under_title", { n: carouselNum }) || `Konfirmasi Interlock Lower Limit CR${carouselNum}`)
        : (t("confirm_interlock_over_title", { n: carouselNum }) || `Konfirmasi Interlock Upper Limit CR${carouselNum}`);
    const targetStatus = newVal ? `<strong style="color:#059669;">${t('status_on')}</strong>` : `<strong style="color:#dc2626;">${t('status_off')}</strong>`;
    const desc = isUnder
        ? (t("confirm_interlock_under_desc", { n: carouselNum, status: targetStatus }) || `Ubah status Lower Limit Interlock CR${carouselNum} menjadi ${targetStatus}?`)
        : (t("confirm_interlock_over_desc", { n: carouselNum, status: targetStatus }) || `Ubah status Upper Limit Interlock CR${carouselNum} menjadi ${targetStatus}?`);

    openConfigConfirmModal(
        title,
        desc,
        () => {
            checkboxEl.checked = oldVal;
        },
        async (password) => {
            const clone = JSON.parse(JSON.stringify(appSettings));
            if (!clone.interlocksUnder) clone.interlocksUnder = {};
            if (!clone.interlocksOver) clone.interlocksOver = {};
            if (!clone.interlocks) clone.interlocks = {};

            if (isUnder) {
                clone.interlocksUnder[key] = newVal;
            } else {
                clone.interlocksOver[key] = newVal;
            }
            // Keep legacy interlocks synchronized (true if either is active)
            clone.interlocks[key] = !!(clone.interlocksUnder[key] || clone.interlocksOver[key]);

            return await doExecuteSaveSettings(clone, password);
        }
    );
}

function promptUpdateDeviation(key, type, inputEl) {
    // Fallback if called without type
    if (typeof type === 'object' && !inputEl) {
        inputEl = type;
        type = 'min';
    }

    if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
        alert(t("admin_only_deviation"));
        const prev = type === 'min'
            ? ((appSettings.deviationThresholdsMin && appSettings.deviationThresholdsMin[key] !== undefined)
                ? appSettings.deviationThresholdsMin[key] : (appSettings.deviationThresholds?.[key] ?? 0.05))
            : (appSettings.deviationThresholdsMax?.[key] ?? 0.05);
        inputEl.value = prev;
        return;
    }

    const carouselNum = key.replace('carousel', '');
    const isMin = type === 'min';
    const settingsMap = isMin
        ? (appSettings.deviationThresholdsMin || appSettings.deviationThresholds || {})
        : (appSettings.deviationThresholdsMax || {});
    const oldVal = (settingsMap[key] !== undefined) ? parseFloat(settingsMap[key]) : 0.05;
    const newVal = parseFloat(inputEl.value);

    if (!Number.isFinite(newVal) || newVal < 0) {
        inputEl.value = oldVal;
        return;
    }

    if (oldVal === newVal) return;

    const title = isMin
        ? (t("confirm_deviation_min_title", { n: carouselNum }) || `Konfirmasi Lower Limit Deviasi CR${carouselNum}`)
        : (t("confirm_deviation_max_title", { n: carouselNum }) || `Konfirmasi Upper Limit Deviasi CR${carouselNum}`);
    const desc = isMin
        ? (t("confirm_deviation_min_desc", { n: carouselNum, oldVal, newVal }) || `Ubah deviasi Lower Limit CR${carouselNum} dari ${oldVal} Kg menjadi ${newVal} Kg?`)
        : (t("confirm_deviation_max_desc", { n: carouselNum, oldVal, newVal }) || `Ubah deviasi Upper Limit CR${carouselNum} dari ${oldVal} Kg menjadi ${newVal} Kg?`);

    openConfigConfirmModal(
        title,
        desc,
        () => {
            inputEl.value = oldVal;
        },
        async (password) => {
            const clone = JSON.parse(JSON.stringify(appSettings));
            if (!clone.deviationThresholdsMin) clone.deviationThresholdsMin = {};
            if (!clone.deviationThresholdsMax) clone.deviationThresholdsMax = {};
            if (!clone.deviationThresholds) clone.deviationThresholds = {};

            if (isMin) {
                clone.deviationThresholdsMin[key] = parseFloat(newVal.toFixed(4));
                clone.deviationThresholds[key] = parseFloat(newVal.toFixed(4));
            } else {
                clone.deviationThresholdsMax[key] = parseFloat(newVal.toFixed(4));
            }

            return await doExecuteSaveSettings(clone, password);
        }
    );
}

function promptSaveSqlSettings() {
    if (!currentUser || !currentUser.roles || !currentUser.roles.includes('ROLE_ADMIN')) {
        alert(t("admin_only_sql"));
        return;
    }

    const clone = JSON.parse(JSON.stringify(appSettings));
    const newServer = document.getElementById('cfg-server').value.trim();
    const newPort = parseInt(document.getElementById('cfg-port').value) || 1433;
    const newUid = document.getElementById('cfg-uid').value.trim();
    const newPass = document.getElementById('cfg-pass').value;
    const newDb = document.getElementById('cfg-db').value.trim();
    const newZero = document.getElementById('cfg-table-zero').value.trim();
    const newWeight = document.getElementById('cfg-table-weight').value.trim();
    const newMain = document.getElementById('cfg-table-main').value.trim();
    const sqlAutoReconnect = document.getElementById('cfg-sql-auto-reconnect');
    const newAuto = sqlAutoReconnect ? sqlAutoReconnect.checked : false;

    clone.sql_server = newServer;
    clone.sql_port = newPort;
    clone.sql_uid = newUid;
    clone.sql_pass = newPass;
    clone.sql_db = newDb;
    clone.table_zeroing = newZero;
    clone.table_weight = newWeight;
    clone.table_main = newMain;
    clone.sql_auto_reconnect = newAuto;

    const diffs = [];
    if (appSettings.sql_server !== newServer) diffs.push(`Server: ${appSettings.sql_server || '-'} ➔ ${newServer}`);
    if ((appSettings.sql_port || 1433) !== newPort) diffs.push(`Port: ${appSettings.sql_port || 1433} ➔ ${newPort}`);
    if (appSettings.sql_uid !== newUid) diffs.push(`UID: ${appSettings.sql_uid || '-'} ➔ ${newUid}`);
    if (appSettings.sql_pass !== newPass) diffs.push(`Password database diperbarui`);
    if (appSettings.sql_db !== newDb) diffs.push(`Database: ${appSettings.sql_db || '-'} ➔ ${newDb}`);
    if (appSettings.table_zeroing !== newZero) diffs.push(`Table Zeroing: ${appSettings.table_zeroing || '-'} ➔ ${newZero}`);
    if (appSettings.table_weight !== newWeight) diffs.push(`Table Weight: ${appSettings.table_weight || '-'} ➔ ${newWeight}`);
    if (appSettings.table_main !== newMain) diffs.push(`Table Preset Data: ${appSettings.table_main || '-'} ➔ ${newMain}`);
    if (!!appSettings.sql_auto_reconnect !== newAuto) diffs.push(`Auto-Reconnect: ${appSettings.sql_auto_reconnect ? 'ON' : 'OFF'} ➔ ${newAuto ? 'ON' : 'OFF'}`);

    const title = t("confirm_sql_title");
    let descHtml = '';
    if (diffs.length === 0) {
        descHtml = t('confirm_sql_desc');
    } else {
        descHtml = `<div>${t('confirm_sql_diff_title')}</div>` +
                   '<ul style="margin: 8px 0 4px 18px; padding: 0; color: #2563eb; font-size: 0.88rem; line-height: 1.5;">' +
                   diffs.map(d => `<li>${escapeHtml(d)}</li>`).join('') + '</ul>';
    }

    openConfigConfirmModal(
        title,
        descHtml,
        () => {
            renderSettings();
        },
        async (password) => {
            return await doExecuteSaveSettings(clone, password);
        }
    );
}

// Keep saveSettings alias for compatibility
async function saveSettings(silent = false) {
    promptSaveSqlSettings();
}

async function doExecuteSaveSettings(settingsPayload, password) {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify({
                ...settingsPayload,
                confirmationPassword: password
            })
        });

        const data = await res.json();
        if (res.ok) {
            appSettings = settingsPayload;
            renderSettings();
            if (window.lastCarouselsData) {
                renderCarousels(window.lastCarouselsData);
            }
            setTimeout(() => pollSqlStatus(), 1500);
            showToastSuccess(data.message || 'Pengaturan berhasil diperbarui!');
            return true;
        } else {
            const errorEl = document.getElementById('config-confirm-error');
            const errorMsg = document.getElementById('config-confirm-error-msg');
            if (errorEl && errorMsg) {
                errorMsg.innerText = data.message || "Gagal menyimpan pengaturan.";
                errorEl.style.display = 'block';
            }
            const pwdInput = document.getElementById('config-confirm-password');
            if (pwdInput) {
                pwdInput.select();
                pwdInput.focus();
            }
            return false;
        }
    } catch (e) {
        console.error("Save error:", e);
        const errorEl = document.getElementById('config-confirm-error');
        const errorMsg = document.getElementById('config-confirm-error-msg');
        if (errorEl && errorMsg) {
            errorMsg.innerText = e.message || "Koneksi ke server gagal.";
            errorEl.style.display = 'block';
        }
        return false;
    }
}

function showToastSuccess(msg) {
    let toast = document.getElementById('scada-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'scada-toast';
        toast.style.cssText = 'position:fixed; bottom:25px; right:25px; background:#059669; color:#fff; padding:12px 20px; border-radius:8px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.9rem; transition:opacity 0.3s ease;';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class='bx bx-check-circle' style="font-size:1.3rem;"></i> ${escapeHtml(msg)}`;
    toast.style.opacity = '1';
    toast.style.display = 'flex';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3000);
}

// --- User Management Logic ---
async function loadUsers() {
    try {
        if (!currentUser || !currentUser.accessToken) {
            alert("Error: No access token found. Please Logout and Login again.");
            return;
        }
        const token = currentUser.accessToken;
        const res = await fetch('/api/users', {
            headers: { 'x-access-token': token }
        });

        if (res.ok) {
            const users = await res.json();
            if (Array.isArray(users)) {
                renderUsers(users);
                if (users.length === 0) alert("No users found in database.");
            } else {
                alert("Error: Invalid response format");
            }
        } else {
            const err = await res.text();
            try {
                const jsonErr = JSON.parse(err);
                alert("Failed to load users: " + jsonErr.message);
            } catch (e) {
                alert("Failed to load users: " + res.statusText);
            }
        }
    } catch (e) {
        console.error("Failed to load users", e);
        alert("Network Error loading users: " + e.message);
    }
}

function renderUsers(users) {
    window.lastUsersData = users;
    const tbody = document.getElementById('user-list-body');
    tbody.innerHTML = '';

    users.forEach(u => {
        const roles = u.roles ? u.roles.map(r => r.name).join(', ') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${roles}</td>
            <td style="white-space: nowrap; width: 180px;">
                <div style="display: flex; flex-direction: row; gap: 8px; align-items: center; justify-content: flex-start;">
                    <button class="user-action-btn edit" onclick="showEditUserModal(${u.id}, '${u.username}', '${roles}')">
                        <i class='bx bx-edit-alt'></i> ${t('btn_edit')}
                    </button>
                    <button class="user-action-btn delete" onclick="deleteUser(${u.id})">
                        <i class='bx bx-trash'></i> ${t('btn_delete')}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUserTable(term) {
    if (!window.lastUsersData) return;
    const query = (term || '').toLowerCase().trim();
    const filtered = query
        ? window.lastUsersData.filter(u => {
            const roles = u.roles ? u.roles.map(r => r.name).join(' ').toLowerCase() : '';
            return (u.username || '').toLowerCase().includes(query) ||
                   String(u.id).includes(query) ||
                   roles.includes(query);
          })
        : window.lastUsersData;

    const tbody = document.getElementById('user-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 25px; color: var(--text-muted);">${t('no_data') || 'Tidak ada data pengguna'}</td></tr>`;
        return;
    }
    filtered.forEach(u => {
        const roles = u.roles ? u.roles.map(r => r.name).join(', ') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${roles}</td>
            <td style="white-space: nowrap; width: 180px;">
                <div style="display: flex; flex-direction: row; gap: 8px; align-items: center; justify-content: flex-start;">
                    <button class="user-action-btn edit" onclick="showEditUserModal(${u.id}, '${u.username}', '${roles}')">
                        <i class='bx bx-edit-alt'></i> ${t('btn_edit')}
                    </button>
                    <button class="user-action-btn delete" onclick="deleteUser(${u.id})">
                        <i class='bx bx-trash'></i> ${t('btn_delete')}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
window.filterUserTable = filterUserTable;

function showAddUserModal() {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-role').value = 'user';
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
}

async function submitUserCreation() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-role').value;

    if (!username || !password) {
        alert("Username and Password are required");
        return;
    }

    createUser({ username, password, roles: [role] });
}

async function createUser(userData) {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/auth/signup', { // Use Auth Signup or User Create? Auth signup handles roles better usually
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(userData)
        });
        if (res.ok) {
            alert('User Created');
            closeUserModal();
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error: ' + err.message);
        }
    } catch (e) {
        alert('Create failed');
    }
}

async function deleteUser(id) {
    if (!confirm(t('confirm_delete_user'))) return;

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            loadUsers();
        } else {
            alert('Failed to delete');
        }
    } catch (e) {
        alert('Delete error');
    }
}

function showEditUserModal(id, username, rolesStr) {
    document.getElementById('edit-user-modal').style.display = 'flex';
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-password').value = '';
    
    // Determine primary role for select
    let primaryRole = 'user';
    if (rolesStr.includes('admin')) primaryRole = 'admin';
    else if (rolesStr.includes('guest')) primaryRole = 'guest';
    document.getElementById('edit-role').value = primaryRole;
}

function closeEditUserModal() {
    document.getElementById('edit-user-modal').style.display = 'none';
}

async function submitUserEdit() {
    const id = document.getElementById('edit-user-id').value;
    const password = document.getElementById('edit-password').value.trim();
    const role = document.getElementById('edit-role').value;

    const updateData = {};
    if (password) {
        updateData.password = password;
    }
    updateData.roles = [role];

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(updateData)
        });
        
        if (res.ok) {
            alert('User updated successfully');
            closeEditUserModal();
            loadUsers();
        } else {
            const err = await res.json();
            alert('Error updating user: ' + (err.message || res.statusText));
        }
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

function renderCarousels(carousels) {
    window.lastCarouselsData = carousels;
    const container = document.getElementById('view-home');
    container.innerHTML = '';

    // Update Footer Sensors
    updateFooterSensors(carousels);

    for (let i = 1; i <= 5; i++) {
        const carousel = carousels ? carousels[i] : null;
        const col = document.createElement('div');
        // Map State to Class
        const stateClass =
            (carousel && carousel.state === 'RUN') ? 'status-running' :
                (carousel && carousel.state === 'PAUSE') ? 'status-paused' :
                    (carousel && carousel.state === 'STOP') ? 'status-stopped' :
                        (carousel && carousel.state === 'RESET') ? 'status-reset' : '';

        col.className = `carousel-col ${stateClass}`;
        // Add Click Handler
        col.onclick = (e) => {
            // Prevent if clicking update button
            if (e.target.closest('.update-btn')) return;
            openControlModal(i, carousel ? carousel.state : 'OFFLINE');
        };
        col.style.cursor = 'pointer';

        // Determine MD Status (Interlock status)
        const key = `carousel${i}`;
        let isInterlocked = false;
        if (appSettings && appSettings.interlocks && appSettings.interlocks[key] !== undefined) {
            isInterlocked = !!appSettings.interlocks[key];
        } else if (carousel && (carousel.interlock !== undefined || (carousel.data && carousel.data.interlock !== undefined))) {
            isInterlocked = carousel.interlock !== undefined ? !!carousel.interlock : !!carousel.data.interlock;
        }

        let isUnder = false;
        let isOver = false;
        if (appSettings) {
            isUnder = !!(appSettings.interlocksUnder && appSettings.interlocksUnder[key] !== undefined ? appSettings.interlocksUnder[key] : (appSettings.interlocks && appSettings.interlocks[key]));
            isOver = !!(appSettings.interlocksOver && appSettings.interlocksOver[key]);
        }
        let mdStatusText = 'Bypassed';
        if (isUnder && isOver) {
            mdStatusText = 'Active (Under + Over)';
        } else if (isUnder) {
            mdStatusText = 'Active (Under)';
        } else if (isOver) {
            mdStatusText = 'Active (Over)';
        } else if (isInterlocked) {
            mdStatusText = 'Active';
        }
        const mdStatusClass = (isUnder || isOver || isInterlocked) ? 'md-status-normal' : 'md-status-bypassed';

        if (carousel && carousel.data && carousel.data.productId) {
            const d = carousel.data;
            const counter = parseInt(d.counter) || 0;
            const target = parseInt(d.target) || 1;
            const progress = Math.min((counter / target) * 100, 100);

            // Show the last stored PRODUCT_COUNT so the dashboard card matches SQL history.
            const displayedCounter = (d._lastInsertedProductCount !== undefined && d._lastInsertedProductCount !== null)
                ? (parseInt(d._lastInsertedProductCount, 10) || 0)
                : 0;

            // Determine Weight Class based on logic
            let weightClass = '';

            if (carousel.state === 'STOP') {
                weightClass = 'bg-info';
            } else if (carousel.state === 'RUN') {
                if (d.lastGross < d.toleranceMin) {
                    weightClass = 'bg-danger';
                } else if (d.lastGross > d.toleranceMax) {
                    weightClass = 'bg-warning';
                } else {
                    weightClass = 'bg-success';
                }
            } else {
                // Default handling for other states (PAUSE/RESET) if needed
                // Currently defaults to base style (Teal/Primary)
                // If user wants Green for PAUSE/RESET too, uncomment below:
                // weightClass = 'bg-success';
            }

            col.innerHTML = `
                <div class="carousel-card">
                    <div class="card-loading-overlay">
                        <div class="spinner"></div>
                        <div class="loading-text">${t('updating_data')}</div>
                    </div>

                    <div class="card-header">
                        <div class="carousel-number">${t('carousel_n', { n: i })}</div>
                        <div class="carousel-name">${d.productName || carousel.name}</div>
                    </div>
                    
                    <div class="card-body">
                        <div class="info-row">
                            <span class="info-label">${t('card_product_id')}</span>
                            <span class="info-value">${d.productId}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">${t('card_packing_order')}</span>
                            <span class="info-value">${d.packingOrder}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">${t('card_package')}</span>
                            <span class="info-value" title="${d.packagingMaterial || '-'}">${d.packagingMaterial || '-'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">${t('card_tolerance')}</span>
                            <span class="info-value">${d.toleranceMin} — ${d.toleranceMax} Kg</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">${t('card_pack_weight')}</span>
                            <span class="info-value">${(parseFloat(d.packWeight) || 0).toFixed(2)} Kg</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">${t('card_md_status')}</span>
                            <span class="info-value ${mdStatusClass}">${mdStatusText}</span>
                        </div>
                    </div>

                    <div class="weight-section">
                        <div class="weight-label">${t('card_gross_weight')}</div>
                        <div class="weight-display ${weightClass}">${(d.lastGross || 0).toFixed(2)} Kg</div>
                    </div>

                    <div class="progress-section">
                        <div class="progress-info">
                            <span>${t('card_counter_pcs', { n: displayedCounter })}</span>
                            <span>${t('card_target_pcs', { n: target })}</span>
                        </div>
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill" style="width: ${progress.toFixed(1)}%"></div>
                        </div>
                    </div>

                    <div class="stats-grid" title="${t('card_stats_tooltip')}">
                        <div class="stat-box">
                            <div class="stat-label">${t('card_min_1h')}</div>
                            <div class="stat-value">${(d.minVal || 0).toFixed(2)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">${t('card_nett')}</div>
                            <div class="stat-value">${(d.lastNett || 0).toFixed(2)}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">${t('card_avg_1h')}</div>
                            <div class="stat-value">${(d.average || 0).toFixed(2)}</div>
                        </div>
                    </div>

                    <div class="card-footer">
                        <button class="update-btn" onclick="triggerManualUpdate(${i}, event)">
                            <i class='bx bx-refresh'></i> ${t('card_btn_update')}
                        </button>
                    </div>
                </div>
            `;
        } else {
            col.innerHTML = `
                <div class="empty-state">
                    <div class="card-loading-overlay">
                        <div class="spinner"></div>
                        <div class="loading-text">${t('updating_data')}</div>
                    </div>
                    <i class='bx bx-time-five' style="font-size: 2.2rem; color: var(--accent-warning); opacity: 0.85; margin-bottom: 8px;"></i>
                    <span style="font-size:1rem; font-weight:600; color:var(--text-secondary);">${t('carousel_n', { n: i })}</span>
                    <span style="font-weight:700; color:var(--accent-warning); letter-spacing:1px; margin-top:5px; margin-bottom:6px;">${t('card_waiting_order')}</span>
                    <div style="font-size: 0.78rem; display: flex; gap: 6px; align-items: center; margin-bottom: 12px;">
                        <span style="color: var(--text-muted); text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px;">${t('card_md_status')}:</span>
                        <span class="${mdStatusClass}">${mdStatusText}</span>
                    </div>
                    <div class="weight-section" style="width: 100%; padding: 0 14px;">
                        <div class="weight-label">${t('card_gross_weight')}</div>
                        <div class="weight-display bg-warning">0.00 Kg</div>
                    </div>
                </div>
            `;
            col.style.borderColor = "var(--accent-warning)";
            col.style.boxShadow = "none";
        }

        container.appendChild(col);
    }
    activateMobileCard();
}

// --- Manual Update Integration ---
async function triggerManualUpdate(id, event) {
    if (event) event.stopPropagation();

    // Show loading immediately for better UX
    const overlays = document.querySelectorAll('.card-loading-overlay');
    overlays.forEach(overlay => overlay.classList.add('active'));

    try {
        const token = localStorage.getItem('scada_token');
        const res = await fetch('/api/scada/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });
        if (!res.ok) throw new Error("Failed to refresh data");
    } catch (err) {
        console.error("Manual refresh error:", err.message);
        // Hide on error
        overlays.forEach(overlay => overlay.classList.remove('active'));
    }
}

// --- Control Modal Logic ---
let currentControlId = null;

function openControlModal(id, currentState) {
    currentControlId = id;
    const modal = document.getElementById('control-modal');
    document.getElementById('modal-title').innerText = `Control: Carousel ${id}`;

    const statusSpan = document.getElementById('modal-status-val');
    statusSpan.innerText = currentState || 'UNKNOWN';
    statusSpan.className = '';
    if (currentState === 'RUN') statusSpan.classList.add('text-success');
    if (currentState === 'RESET') statusSpan.style.color = '#3b82f6';
    // color is handled by CSS vars usually

    // Disable logic if needed?? User said: "Apabila tag OPC kosong atau offline maka semua kontrol tadi akan disabled"
    // We can check opc connection status here if we have it globally? 
    // We have opcua-status event. Let's start basic.

    modal.style.display = 'flex';
}

function closeControlModal() {
    document.getElementById('control-modal').style.display = 'none';
    currentControlId = null;
}

window.onclick = function (event) {
    const controlModal = document.getElementById('control-modal');
    const opcEditModal = document.getElementById('opcua-edit-modal');
    const configConfirmModal = document.getElementById('config-confirm-modal');
    if (event.target === controlModal) {
        closeControlModal();
    }
    if (event.target === opcEditModal) {
        closeOpcUaEditModal();
    }
    if (event.target === configConfirmModal) {
        closeConfigConfirmModal();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const opcEditModal = document.getElementById('opcua-edit-modal');
    if (opcEditModal && opcEditModal.style.display === 'flex') {
        closeOpcUaEditModal();
    }
    const configConfirmModal = document.getElementById('config-confirm-modal');
    if (configConfirmModal && configConfirmModal.style.display === 'flex') {
        closeConfigConfirmModal();
    }
});

async function sendControlCommand(command) {
    if (!currentControlId) return;

    // Check if OPC is connected (Client side check)
    // REMOVED: Control is now via SQL, independant of OPC status.
    /*
    const badge = document.getElementById('opcua-status-badge');
    if (badge && badge.innerText === 'DISCONNECTED') {
        alert("Cannot send command: OPC-UA is Disconnected");
        return;
    }
    */

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify({ carouselId: currentControlId, command })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            closeControlModal();
        } else {
            alert("Error: " + (data.error || 'Command Failed'));
        }
    } catch (e) {
        alert("Command Error: " + e.message);
    }
}

async function triggerResetError() {
    const btn = document.getElementById('btn-reset-error');
    const originalHtml = btn ? btn.innerHTML : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> RESETTING...";
        }

        const token = currentUser && currentUser.accessToken;
        const res = await fetch('/api/control/reset-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'x-access-token': token } : {})
            }
        });
        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            if (!res.ok) {
                const msg = res.status === 404
                    ? 'Endpoint reset-error belum tersedia. Restart backend lalu coba lagi.'
                    : `Server returned non-JSON response (HTTP ${res.status})`;
                showOpcUaToast(msg, 'error');
                return;
            }
            throw parseErr;
        }

        if (res.ok && data && data.success) {
            showOpcUaToast('Reset error signal sent', 'success');
        } else {
            showOpcUaToast((data && data.error) || `Failed to send reset signal (HTTP ${res.status})`, 'error');
        }
    } catch (e) {
        showOpcUaToast(`Reset error failed: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></span> RESET';
        }
    }
}

// ==========================================================
// OPC-UA Configuration Functions
// ==========================================================

let opcuaConfig = null;
let opcuaLiveValues = {};

function formatOpcUaValue(value) {
    if (value === null || value === undefined) return '—';
    // Preserve booleans as-is
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    // Try numeric conversion for numeric-like values
    const num = Number(value);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
        // If non-integer, show 2 decimal places; otherwise show integer
        return (num % 1 !== 0) ? num.toFixed(2) : String(num);
    }
    return String(value);
}

// Find the live value for a node by its signalType and machineId.
// Robust against node name changes (e.g. "Sensor CR1" vs "S1").
function findOpcUaLiveBySignal(signalType, machineId) {
    if (!opcuaConfig || !Array.isArray(opcuaConfig.nodes)) return null;
    const wantedType = (signalType || '').toString().trim().toUpperCase();
    const wantedMachine = parseInt(machineId, 10);
    const node = opcuaConfig.nodes.find(n => {
        const t = getOpcUaNodeSignalType(n);
        const m = parseInt(getOpcUaNodeMachineId(n), 10);
        return t === wantedType && m === wantedMachine;
    });
    if (!node) return null;
    return opcuaLiveValues[node.name] || null;
}

function getOpcUaNodeMachineId(node) {
    if (!node) return '';
    if (node.machineId !== undefined && node.machineId !== null && node.machineId !== '') {
        return String(node.machineId);
    }
    const fromName = (node.name || '').match(/^(?:CR|S)([1-5])$/i);
    if (fromName) return fromName[1];
    const fromNodeId = (node.nodeId || '').match(/(?:CR0?([1-5])|SENSOR0?([1-5]))/i);
    if (fromNodeId) return String(fromNodeId[1] || fromNodeId[2] || '');
    return '';
}

function getOpcUaNodeSignalType(node) {
    const current = (node && node.signalType ? String(node.signalType) : '').trim().toUpperCase();
    if (current) return current;

    const name = (node && node.name ? String(node.name) : '').trim().toUpperCase();
    const nodeId = (node && node.nodeId ? String(node.nodeId) : '').trim().toUpperCase();

    if (/^CR[1-5]$/.test(name) || /GR_CR0?[1-5]/.test(nodeId) || /GROSS/.test(nodeId)) return 'GROSS_WEIGHT';
    if (/^S[1-5]$/.test(name) || /SENSOR0?[1-5]/.test(nodeId)) return 'PRODUCT_SENSOR';
    if (/^RST$|^RESET$/.test(name) || /RESET/.test(nodeId)) return 'RESET';
    if (/MD[_\s-]?SWITCH/.test(name) || /MD[_\s-]?SWITCH/.test(nodeId)) return 'MD_SWITCH';
    if (/SYSTEM[_\s-]?PAUSED/.test(name) || /SYSTEM[_\s-]?PAUSED/.test(nodeId)) return 'SYSTEM_PAUSED';
    if (/COUNT/.test(name) || /COUNT/.test(nodeId)) return 'COUNTER';
    if (/TOLERANCE[_\s-]?MIN/.test(name) || /TOLERANCE[_\s-]?MIN/.test(nodeId)) return 'TOLERANCE_MIN';
    if (/TOLERANCE[_\s-]?MAX/.test(name) || /TOLERANCE[_\s-]?MAX/.test(nodeId)) return 'TOLERANCE_MAX';
    if (/THRESHOLD[_\s-]?MAX/.test(name) || /THRESHOLD[_\s-]?MAX/.test(nodeId) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MAX/.test(name) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MAX/.test(nodeId)) return 'THRESHOLD_MAX';
    if (/THRESHOLD[_\s-]?MIN/.test(name) || /THRESHOLD[_\s-]?MIN/.test(nodeId) || /THRESHOLD/.test(name) || /THRESHOLD/.test(nodeId) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(name) || /DEVIATION[_\s-]?TOLERANCE[_\s-]?MIN/.test(nodeId)) return 'THRESHOLD_MIN';
    return '';
}

function getOpcUaNodeScale(node) {
    const parsed = Number(node && node.scale);
    return Number.isFinite(parsed) ? parsed : 0.01;
}

async function loadOpcUaConfig() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config', {
            headers: { 'x-access-token': token }
        });
        if (res.ok) {
            opcuaConfig = await res.json();
            document.getElementById('opcua-endpoint').value = opcuaConfig.endpointUrl || '';
            document.getElementById('opcua-security').value = opcuaConfig.securityMode || 'None';
            document.getElementById('opcua-policy').value = opcuaConfig.securityPolicy || 'Basic256';
            document.getElementById('opcua-publish').value = opcuaConfig.publishInterval || 1000;
            document.getElementById('opcua-sampling').value = opcuaConfig.samplingInterval || 500;
            document.getElementById('opcua-autoconnect').checked = opcuaConfig.autoConnect || false;
            document.getElementById('opcua-username').value = opcuaConfig.username || '';
            document.getElementById('opcua-password').value = opcuaConfig.password || '';
            renderOpcUaNodes();
        }

        const statusRes = await fetch('/api/opcua/status', {
            headers: { 'x-access-token': token }
        });
        if (statusRes.ok) {
            const st = await statusRes.json();
            updateOpcUaStatusUI(st);
            updateFooterConnections({ opcStatus: st });
        }
    } catch (e) {
        showOpcUaToast('Failed to load OPC-UA config', 'error');
    }
}

async function saveOpcUaConfig() {
    const config = {
        endpointUrl: document.getElementById('opcua-endpoint').value.trim(),
        securityMode: document.getElementById('opcua-security').value,
        securityPolicy: document.getElementById('opcua-policy').value,
        publishInterval: parseInt(document.getElementById('opcua-publish').value) || 1000,
        samplingInterval: parseInt(document.getElementById('opcua-sampling').value) || 500,
        autoConnect: document.getElementById('opcua-autoconnect').checked,
        username: document.getElementById('opcua-username').value.trim(),
        password: document.getElementById('opcua-password').value
    };

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig = data.config;
            showOpcUaToast('Config saved', 'success');
        } else {
            showOpcUaToast(data.error || 'Save failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Save error', 'error');
    }
}

async function opcuaConnect() {
    const btn = document.getElementById('btn-opcua-connect');
    btn.disabled = true;
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> CONNECTING...";

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/connect', {
            method: 'POST',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            showOpcUaToast('Connected to OPC-UA server', 'success');
        } else {
            showOpcUaToast(data.error || 'Connect failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Connect error', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = "<i class='bx bx-plug'></i> CONNECT";
}

async function opcuaDisconnect() {
    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/disconnect', {
            method: 'POST',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            showOpcUaToast('Disconnected', 'success');
        } else {
            showOpcUaToast(data.error || 'Disconnect failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Disconnect error', 'error');
    }
}

async function addOpcUaNode() {
    const nodeId = document.getElementById('opcua-new-nodeid').value.trim();
    const name = document.getElementById('opcua-new-name').value.trim();
    const machineId = document.getElementById('opcua-new-machine').value;
    const signalType = document.getElementById('opcua-new-signal').value;
    const scale = parseFloat(document.getElementById('opcua-new-scale').value) || 0.01;
    const desc = document.getElementById('opcua-new-desc').value.trim();
    if (!nodeId) { showOpcUaToast('Node ID required', 'error'); return; }

    try {
        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify({ nodeId, name: name || nodeId, machineId, signalType, scale, description: desc })
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            document.getElementById('opcua-new-nodeid').value = '';
            document.getElementById('opcua-new-name').value = '';
            document.getElementById('opcua-new-desc').value = '';
            showOpcUaToast('Node added', 'success');
        } else {
            showOpcUaToast(data.error || 'Add failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Add error', 'error');
    }
}

function exportOpcUaNodes() {
    if (!opcuaConfig || !Array.isArray(opcuaConfig.nodes)) {
        showOpcUaToast(t('nodes_export_failed'), 'error');
        return;
    }
    const nodes = opcuaConfig.nodes;
    const exportData = {
        format: 'scada-opcua-nodes',
        version: 1,
        exportedAt: new Date().toISOString(),
        nodes
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `opcua-nodes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showOpcUaToast(t('nodes_exported_success'), 'success');
}

async function importOpcUaNodes(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
        let imported;
        try {
            imported = JSON.parse(await file.text());
        } catch {
            showOpcUaToast(t('nodes_import_invalid_file'), 'error');
            return;
        }

        const nodes = Array.isArray(imported) ? imported : imported && imported.nodes;
        if (!Array.isArray(nodes)) {
            showOpcUaToast(t('nodes_import_invalid_file'), 'error');
            return;
        }
        if (!confirm(t('confirm_import_nodes', { count: nodes.length }))) return;

        const token = currentUser.accessToken;
        const res = await fetch('/api/opcua/config/nodes/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token },
            body: JSON.stringify({ nodes })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showOpcUaToast(data.error || t('nodes_import_failed'), 'error');
            return;
        }

        opcuaConfig.nodes = data.nodes;
        opcuaLiveValues = {};
        renderOpcUaNodes();
        showOpcUaToast(t('nodes_imported_success', { count: data.nodes.length }), 'success');
    } catch (err) {
        console.error('OPC-UA node import failed:', err);
        showOpcUaToast(t('nodes_import_failed'), 'error');
    } finally {
        fileInput.value = '';
    }
}

async function removeOpcUaNode(index) {
    const targetNode = opcuaConfig && opcuaConfig.nodes ? opcuaConfig.nodes[index] : null;
    if (!confirm(`Delete monitored node "${targetNode ? targetNode.name : index + 1}"?`)) return;

    try {
        const token = currentUser.accessToken;
        const res = await fetch(`/api/opcua/config/nodes/${index}`, {
            method: 'DELETE',
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        if (data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            showOpcUaToast('Node removed', 'success');
        } else {
            showOpcUaToast(data.error || 'Remove failed', 'error');
        }
    } catch (e) {
        showOpcUaToast('Remove error', 'error');
    }
}

function renderOpcUaNodes() {
    if (!opcuaConfig) return;
    const tbody = document.getElementById('opcua-nodes-body');
    tbody.innerHTML = '';
    document.getElementById('opcua-node-count').innerText = `${opcuaConfig.nodes.length} node${opcuaConfig.nodes.length !== 1 ? 's' : ''}`;

    if (opcuaConfig.nodes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999; padding:20px;">${t("no_nodes_configured")}</td></tr>`;
        return;
    }

    opcuaConfig.nodes.forEach((node, idx) => {
        const liveVal = opcuaLiveValues[node.name];
        const machineId = getOpcUaNodeMachineId(node);
        const machineLabel = machineId ? `CR${machineId}` : 'Global';
        const signalType = getOpcUaNodeSignalType(node);
        const scale = getOpcUaNodeScale(node);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-family: var(--font-digital); font-size: 0.8rem;">${node.nodeId}</td>
            <td style="font-weight: 600">${node.name}</td>
            <td>${machineLabel}</td>
            <td><span style="font-size:0.75rem; background:rgba(99,102,241,0.15); color:#818cf8; padding:2px 6px; border-radius:4px;">${signalType || '—'}</span></td>
            <td style="font-family: var(--font-digital)">${scale}</td>
            <td>${node.description || '—'}</td>
            <td style="font-family: var(--font-digital)" id="opcua-live-${idx}">${liveVal !== undefined ? formatOpcUaValue(liveVal.value) : '—'}</td>
            <td>
                <div class="opc-node-actions">
                    <button class="opc-action-btn edit" title="Edit monitored node" onclick="editOpcUaNode(${idx})">
                        <i class='bx bx-edit-alt'></i> ${t('btn_edit')}
                    </button>
                    <button class="opc-action-btn delete" title="Delete monitored node" onclick="removeOpcUaNode(${idx})">
                        <i class='bx bx-trash'></i> ${t('btn_delete')}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateOpcUaStatusUI(status) {
    const badge = document.getElementById('opcua-status-badge');
    const dot = document.getElementById('opcua-nav-dot');
    const btnConn = document.getElementById('btn-opcua-connect');
    const btnDisc = document.getElementById('btn-opcua-disconnect');

    if (!badge || !dot) return;

    badge.className = 'opcua-badge';
    dot.className = 'opcua-dot';

    if (status.connected) {
        badge.innerText = 'CONNECTED';
        badge.classList.add('connected');
        dot.classList.add('connected');
        btnConn.style.display = 'none';
        btnDisc.style.display = 'inline-block';
    } else if (status.connecting) {
        badge.innerText = 'CONNECTING...';
        badge.classList.add('connecting');
        dot.classList.add('connecting');
        btnConn.style.display = 'none';
        btnDisc.style.display = 'none';
    } else {
        badge.innerText = 'DISCONNECTED';
        btnConn.style.display = 'inline-block';
        btnDisc.style.display = 'none';
    }

    if (status.liveValues) {
        opcuaLiveValues = status.liveValues;
        // Trigger UI update for all known values
        if (opcuaConfig && opcuaConfig.nodes) {
            Object.values(status.liveValues).forEach(val => updateOpcUaLiveValue(val));
        }
        // Always refresh footer sensors
        updateFooterSensors();
    }
}

function updateOpcUaLiveValue(data) {
    if (!data || !data.name) return;
    opcuaLiveValues[data.name] = data;
    console.log('[OPC-UA] Live Value:', data.name, data.value); // Debug log

    // If it's a sensor update, refresh the footer sensor indicators
    const nodeForValue = opcuaConfig && opcuaConfig.nodes
        ? opcuaConfig.nodes.find(n => (n.name || '').toString().trim() === data.name)
        : null;
    if (nodeForValue && getOpcUaNodeSignalType(nodeForValue) === 'PRODUCT_SENSOR') {
        updateFooterSensors();
    }

    if (opcuaConfig) {
        const idx = opcuaConfig.nodes.findIndex(n => n.name === data.name);
        if (idx >= 0) {
            const cell = document.getElementById(`opcua-live-${idx}`);
                if (cell) {
                    cell.innerText = formatOpcUaValue(data.value);
                    const isGood = data.statusCode && data.statusCode.toString().startsWith('Good');
                cell.style.color = isGood ? '#28a745' : '#ffc107';

                // Also update row background flash? (Optional)
                cell.style.transition = 'none';
                cell.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
                setTimeout(() => {
                    cell.style.transition = 'background-color 0.5s';
                    cell.style.backgroundColor = 'transparent';
                }, 100);
            }
        }
    }
}

function showOpcUaToast(msg, type) {
    const existing = document.querySelector('.opcua-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `opcua-toast ${type || ''}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
}

// --- Edit Node Logic ---
let currentEditingNodeIndex = null;
function setOpcUaEditSaving(isSaving) {
    const saveBtn = document.getElementById('opcua-edit-save-btn');
    if (!saveBtn) return;
    saveBtn.disabled = !!isSaving;
    saveBtn.innerText = isSaving ? 'Saving...' : 'Save Changes';
}

function editOpcUaNode(index) {
    if (!opcuaConfig || !opcuaConfig.nodes[index]) return;
    currentEditingNodeIndex = index;
    const node = opcuaConfig.nodes[index];
    const machineId = getOpcUaNodeMachineId(node);
    const signalType = getOpcUaNodeSignalType(node);
    const scale = getOpcUaNodeScale(node);

    document.getElementById('opcua-edit-index').value = `#${index + 1}`;
    document.getElementById('opcua-edit-nodeid').value = node.nodeId || '';
    document.getElementById('opcua-edit-name').value = node.name || '';
    document.getElementById('opcua-edit-machine').value = machineId || '';
    document.getElementById('opcua-edit-signal').value = signalType || 'GROSS_WEIGHT';
    document.getElementById('opcua-edit-scale').value = scale;
    document.getElementById('opcua-edit-desc').value = node.description || '';

    document.getElementById('opcua-edit-modal').style.display = 'flex';
    setOpcUaEditSaving(false);
    document.getElementById('opcua-edit-nodeid').focus();
}

function closeOpcUaEditModal() {
    document.getElementById('opcua-edit-modal').style.display = 'none';
    currentEditingNodeIndex = null;
    setOpcUaEditSaving(false);
}

async function saveOpcUaNodeEdit() {
    if (currentEditingNodeIndex === null) return;

    const nodeId = document.getElementById('opcua-edit-nodeid').value.trim();
    const name = document.getElementById('opcua-edit-name').value.trim();
    if (!nodeId) { showOpcUaToast('Node ID required', 'error'); return; }
    if (!name) { showOpcUaToast('Tag name required', 'error'); return; }

    const payload = {
        nodeId,
        name,
        machineId: document.getElementById('opcua-edit-machine').value,
        signalType: document.getElementById('opcua-edit-signal').value,
        scale: parseFloat(document.getElementById('opcua-edit-scale').value) || 0.01,
        description: document.getElementById('opcua-edit-desc').value.trim()
    };

    try {
        setOpcUaEditSaving(true);
        const token = currentUser.accessToken;
        const res = await fetch(`/api/opcua/config/nodes/${currentEditingNodeIndex}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(payload)
        });

        const raw = await res.text();
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (parseErr) {
            const hint = raw && raw.includes('<!DOCTYPE')
                ? 'Server mengembalikan HTML (kemungkinan proxy/reverse proxy).'
                : 'Server response bukan JSON.';
            throw new Error(`${hint} HTTP ${res.status}`);
        }

        if (res.ok && data && data.success) {
            opcuaConfig.nodes = data.nodes;
            renderOpcUaNodes();
            closeOpcUaEditModal();
            showOpcUaToast('Node updated', 'success');
        } else {
            showOpcUaToast((data && data.error) || `Update failed (HTTP ${res.status})`, 'error');
        }
    } catch (e) {
        showOpcUaToast('Update error: ' + e.message, 'error');
    } finally {
        setOpcUaEditSaving(false);
    }
}

function handleScadaAlert(alertData) {
    if (!alertData || alertData.type !== 'sql_insert_failed') return;

    const carousel = alertData.carousel || 'Unknown Carousel';
    const msg = alertData.message || `Gagal update WEIGHT_DATA untuk ${carousel}`;
    showOperatorToast(`${msg}. Cek koneksi SQL/table.`);
}

function showOperatorToast(msg) {
    const existing = document.querySelector('.operator-toast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.className = 'operator-toast';
    t.innerText = msg;
    document.body.appendChild(t);

    setTimeout(() => { if (t.parentNode) t.remove(); }, 6000);
}

// --- SQL Status Polling ---
async function pollSqlStatus() {
    try {
        const token = currentUser?.accessToken;
        if (!token) {
            console.warn('No token available for SQL status check');
            return;
        }
        
        const res = await fetch('/api/scada/status', {
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        updateSqlStatusUI(data);
    } catch (e) {
        console.error('SQL status poll failed:', e);
        updateSqlStatusUI({ connected: false });
    }
}

// --- History Logic (server-side pagination) ---
let historyTotalCount = 0;
let historyCurrentPage = 1;
let historyPageSize = 50;
let historyLoading = false;

function getHistoryTotalPages() {
    if (!historyTotalCount) return 1;
    return Math.max(1, Math.ceil(historyTotalCount / historyPageSize));
}

function updateHistorySubtitle() {
    const subtitle = document.getElementById('history-subtitle');
    if (!subtitle) return;
    subtitle.textContent = t("history_subtitle");
}

function updateHistoryPaginationUi() {
    const totalPages = getHistoryTotalPages();
    const pageInfo = document.getElementById('history-page-info');
    const rangeInfo = document.getElementById('history-range-info');
    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');
    const firstBtn = document.getElementById('history-first-btn');
    const lastBtn = document.getElementById('history-last-btn');

    if (pageInfo) pageInfo.textContent = t('page_x_of_y', { curr: historyCurrentPage, total: totalPages });

    if (rangeInfo) {
        if (!historyTotalCount) {
            rangeInfo.textContent = t('no_records');
        } else {
            const start = (historyCurrentPage - 1) * historyPageSize + 1;
            const end = Math.min(historyCurrentPage * historyPageSize, historyTotalCount);
            rangeInfo.textContent = t('history_rows_range', { start, end, total: historyTotalCount.toLocaleString() });
        }
    }

    const atStart = historyCurrentPage <= 1;
    const atEnd = historyCurrentPage >= totalPages;
    [prevBtn, firstBtn].forEach(btn => { if (btn) btn.disabled = atStart; });
    [nextBtn, lastBtn].forEach(btn => { if (btn) btn.disabled = atEnd; });
}

function formatHistoryTimestamp(timestampValue) {
    if (!timestampValue) return '-';

    const date = new Date(timestampValue);
    if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date).replace(',', '');
    }

    const raw = String(timestampValue).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return raw;

    const [, year, month, day, hour, minute, second = '00'] = match;
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

function renderHistoryRow(row) {
    const tr = document.createElement('tr');
    const dateStr = formatHistoryTimestamp(row.TIMESTAMP || row.createdAt);
    const grossWeight = row.GROSS_WEIGHT != null ? parseFloat(row.GROSS_WEIGHT).toFixed(2) : '-';
    const nettWeight = row.NETT_WEIGHT != null ? parseFloat(row.NETT_WEIGHT).toFixed(2) : '-';
    const counterValue = row.PRODUCT_COUNT ?? row.COUNTER ?? '-';

    tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${row.CAROUSEL}</td>
        <td>${row.PRODUCT_NAME} <span style="font-size:0.8em; color:#888;">(${row.PRODUCT_ID})</span></td>
        <td>${row.TARGET_COUNT || '-'}</td>
        <td>${counterValue}</td>
        <td>${grossWeight}</td>
        <td>${nettWeight}</td>
        <td><span class="status-badge status-${(row.STATUS || '').toLowerCase()}">${row.STATUS}</span></td>
    `;
    return tr;
}

function renderHistoryRows(rows) {
    const tbody = document.getElementById('history-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">${t('no_records_found')}</td></tr>`;
        updateHistoryPaginationUi();
        return;
    }

    rows.forEach(row => tbody.appendChild(renderHistoryRow(row)));
    updateHistoryPaginationUi();
}

function historyChangePage(delta) {
    const totalPages = getHistoryTotalPages();
    const next = historyCurrentPage + delta;
    if (next < 1 || next > totalPages || historyLoading) return;
    fetchHistoryPage(next);
}

function historyGoToPage(target) {
    const totalPages = getHistoryTotalPages();
    const page = target === 'last' ? totalPages : Math.max(1, parseInt(target, 10) || 1);
    if (page === historyCurrentPage || historyLoading) return;
    fetchHistoryPage(page);
}

function onHistoryPageSizeChange() {
    const select = document.getElementById('history-page-size');
    historyPageSize = parseInt(select?.value, 10) || 50;
    fetchHistoryPage(1);
}

function onHistoryRefreshChange() {
    if (historyIntervalId) {
        clearInterval(historyIntervalId);
        historyIntervalId = null;
    }

    if (currentView === 'history') {
        const select = document.getElementById('history-refresh-interval');
        const seconds = select ? parseInt(select.value, 10) : 30; // default/fallback 30s

        if (seconds > 0) {
            historyIntervalId = setInterval(() => {
                if (currentView === 'history' && !historyLoading) {
                    fetchHistoryPage(historyCurrentPage);
                }
            }, seconds * 1000);
        }
    }
}

async function fetchHistoryPage(page) {
    const tbody = document.getElementById('history-list-body');
    const carouselFilterEl = document.getElementById('history-carousel-filter');
    if (historyLoading) return;
    historyLoading = true;

    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading records...</td></tr>';
    }

    try {
        const token = currentUser.accessToken;
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(historyPageSize)
        });
        const selectedCarousel = carouselFilterEl ? carouselFilterEl.value : '';
        if (selectedCarousel) {
            params.set('carousel', selectedCarousel);
        }

        const res = await fetch(`/api/scada/history?${params.toString()}`, {
            headers: { 'x-access-token': token }
        });

        if (res.ok) {
            const data = await res.json();
            historyTotalCount = data.total || 0;
            historyCurrentPage = data.page || page;
            historyPageSize = data.pageSize || historyPageSize;
            updateHistorySubtitle();
            renderHistoryRows(data.records || []);
            const wrap = document.querySelector('.history-table-wrap');
            if (wrap) wrap.scrollTop = 0;
        } else if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Failed to load history</td></tr>';
            updateHistoryPaginationUi();
        }
    } catch (e) {
        console.error('History Error', e);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Network Error</td></tr>';
        }
        updateHistoryPaginationUi();
    } finally {
        historyLoading = false;
    }
}

function loadHistory() {
    historyTotalCount = 0;
    historyCurrentPage = 1;
    fetchHistoryPage(1);
}

// ==========================================================
// System Log View Functions
// ==========================================================

let allLogEntries = [];
const MAX_ALARM_ENTRIES = 30;
let alarmEntries = [];

function addAlarmEntry(entry) {
    if (!entry) return;
    if (entry.level !== 'WARN' && entry.level !== 'ERROR') return;
    alarmEntries.push(entry);
    if (alarmEntries.length > MAX_ALARM_ENTRIES) alarmEntries.shift();
    renderAlarmTicker();
}

function renderAlarmTicker() {
    const ticker = document.getElementById('alarm-ticker');
    const track = document.getElementById('alarm-ticker-track');
    if (!ticker || !track) return;
    if (alarmEntries.length === 0) {
        ticker.style.display = 'none';
        return;
    }
    ticker.style.display = 'flex';

    const itemHtml = alarmEntries.map(e => {
        const cls = e.level === 'ERROR' ? 'alarm-error' : 'alarm-warn';
        const ts = new Date(e.timestamp).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return '<span class="alarm-item ' + cls + '">' +
            '<span class="alarm-src">[' + escapeHtml(e.source || 'SYSTEM') + ']</span>' +
            '<span class="alarm-time">' + ts + '</span>' +
            escapeHtml(e.message || '') +
            '</span>';
    }).join('');

    // Duplikasi konten agar loop translateX(-50%) seamless
    track.innerHTML = itemHtml + itemHtml;

    // Durasi proporsional jumlah item supaya kecepatan scroll konsisten
    // (diperlambat 4x dari nilai awal 80s / 20s-per-item)
    const duration = Math.max(320, alarmEntries.length * 80);
    track.style.animationDuration = duration + 's';
}

async function loadAlarmTicker() {
    try {
        const token = localStorage.getItem('scada_token') || (currentUser && currentUser.accessToken);
        const res = await fetch('/api/logs', { headers: { 'x-access-token': token } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        alarmEntries = data
            .filter(e => e.level === 'WARN' || e.level === 'ERROR')
            .slice(-MAX_ALARM_ENTRIES);
        renderAlarmTicker();
    } catch (e) {
        console.error('Failed to load alarm ticker', e);
    }
}

// Manual alarm reset: clear local alarm buffer AND server log buffer.
async function resetAlarms() {
    // Clear local buffer immediately so the ticker hides without waiting on network
    alarmEntries = [];
    renderAlarmTicker();

    try {
        const token = localStorage.getItem('scada_token') || (currentUser && currentUser.accessToken);
        await fetch('/api/logs/clear-alarms', {
            method: 'POST',
            headers: { 'x-access-token': token }
        });
    } catch (e) {
        console.error('Failed to clear alarm buffer on server', e);
    }
}

async function loadLogs() {
    const container = document.getElementById('log-container');
    if (!container) return;
    container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">Loading logs...</span></div>';

    try {
        const token = localStorage.getItem('scada_token') || (currentUser && currentUser.accessToken);
        const res = await fetch('/api/logs', {
            headers: { 'x-access-token': token }
        });
        const data = await res.json();
        allLogEntries = data || [];
        renderLogEntries();
    } catch (e) {
        container.innerHTML = '<div class="log-entry log-level-error"><span class="log-msg">Failed to load logs</span></div>';
    }
}

function appendLogEntry(entry) {
    if (!entry) return;
    allLogEntries.push(entry);
    // Keep max 500 in frontend buffer
    if (allLogEntries.length > 500) allLogEntries.shift();

    // Check if filters match
    const levelFilter = document.getElementById('log-level-filter')?.value || '';
    const sourceFilter = document.getElementById('log-source-filter')?.value || '';
    if (levelFilter && entry.level !== levelFilter) return;
    if (sourceFilter && entry.source !== sourceFilter) return;

    const container = document.getElementById('log-container');
    if (!container) return;

    // Remove placeholder
    const placeholder = container.querySelector('.log-msg');
    if (placeholder && placeholder.innerText === 'Waiting for log entries...') {
        container.innerHTML = '';
    }

    const div = createLogEntryElement(entry);
    container.appendChild(div);

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function createLogEntryElement(entry) {
    const div = document.createElement('div');
    const levelClass = `log-level-${(entry.level || 'info').toLowerCase()}`;
    div.className = `log-entry ${levelClass}`;

    const ts = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(entry.timestamp).toLocaleDateString('en-GB');

    div.innerHTML = `
        <span class="log-ts">${date} ${ts}</span>
        <span class="log-badge log-badge-${(entry.level || 'info').toLowerCase()}">${entry.level || 'INFO'}</span>
        <span class="log-src">${entry.source || 'SYSTEM'}</span>
        <span class="log-msg">${escapeHtml(entry.message || '')}</span>
    `;
    return div;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function filterLogs() {
    renderLogEntries();
}

function renderLogEntries() {
    const container = document.getElementById('log-container');
    if (!container) return;

    const levelFilter = document.getElementById('log-level-filter')?.value || '';
    const sourceFilter = document.getElementById('log-source-filter')?.value || '';

    let filtered = allLogEntries;
    if (levelFilter) filtered = filtered.filter(e => e.level === levelFilter);
    if (sourceFilter) filtered = filtered.filter(e => e.source === sourceFilter);

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">No log entries found</span></div>';
        return;
    }

    filtered.forEach(entry => {
        container.appendChild(createLogEntryElement(entry));
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function clearLogView() {
    const container = document.getElementById('log-container');
    if (container) {
        container.innerHTML = '<div class="log-entry log-level-info"><span class="log-msg">Log view cleared</span></div>';
    }
    allLogEntries = [];
}

// ==========================================================================
// USER ACTIVITY & AUDIT TRAIL LOGIC
// ==========================================================================
let auditPagination = {
    currentPage: 1,
    pageSize: 50,
    totalPages: 1,
    totalRecords: 0
};

async function loadAuditStats() {
    try {
        if (!currentUser || !currentUser.accessToken) return;
        const res = await fetch('/api/audit-logs/stats', {
            headers: { 'x-access-token': currentUser.accessToken }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.stats) {
                const elTotal = document.getElementById('audit-stat-total');
                const elAuth = document.getElementById('audit-stat-auth');
                const elCtrl = document.getElementById('audit-stat-control');
                const elSet = document.getElementById('audit-stat-settings');
                if (elTotal) elTotal.innerText = data.stats.todayTotal || 0;
                if (elAuth) elAuth.innerText = data.stats.todayAuth || 0;
                if (elCtrl) elCtrl.innerText = data.stats.todayControl || 0;
                if (elSet) elSet.innerText = data.stats.todaySettings || 0;
            }
        }
    } catch (e) {
        console.error("Failed to load audit stats:", e);
    }
}

function getAuditFilterParams(page = 1) {
    const category = document.getElementById('audit-filter-category')?.value || '';
    const target = document.getElementById('audit-filter-target')?.value || '';
    const startDate = document.getElementById('audit-filter-start-date')?.value || '';
    const endDate = document.getElementById('audit-filter-end-date')?.value || '';
    const search = document.getElementById('audit-filter-search')?.value || '';
    const limit = auditPagination.pageSize || 50;

    const params = new URLSearchParams({
        page: page,
        limit: limit
    });

    if (category) params.append('category', category);
    if (target) params.append('target', target);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (search.trim()) params.append('search', search.trim());

    return params;
}

async function loadAuditLogs(page = 1) {
    try {
        if (!currentUser || !currentUser.accessToken) return;
        const tbody = document.getElementById('audit-list-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 25px; color: #94a3b8;"><i class='bx bx-loader-alt bx-spin' style="font-size:1.5rem; margin-bottom:6px; display:block;"></i>Memuat data audit trail...</td></tr>`;
        }

        const params = getAuditFilterParams(page);
        const res = await fetch(`/api/audit-logs?${params.toString()}`, {
            headers: { 'x-access-token': currentUser.accessToken }
        });

        if (res.ok) {
            const data = await res.json();
            auditPagination.currentPage = data.currentPage;
            auditPagination.totalPages = data.totalPages;
            auditPagination.totalRecords = data.total;

            renderAuditTable(data.logs || []);
            updateAuditPaginationUI();
        } else {
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 20px;">Gagal memuat log: ${res.statusText}</td></tr>`;
            }
        }
    } catch (e) {
        console.error("Error loading audit logs:", e);
        const tbody = document.getElementById('audit-list-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding: 20px;">${t('audit_load_failed')}</td></tr>`;
        }
    }
}

function renderAuditTable(logs) {
    const tbody = document.getElementById('audit-list-body');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: #94a3b8;"><i class='bx bx-info-circle' style="font-size:1.8rem; margin-bottom:6px; display:block;"></i>${t('no_audit_activities')}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.id = `audit-row-${log.id}`;

        const dt = new Date(log.createdAt);
        const dateFormatted = dt.toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\./g, ':');

        let catClass = 'badge-cat-auth';
        if (log.category === 'CAROUSEL') catClass = 'badge-cat-carousel';
        else if (log.category === 'SETTINGS') catClass = 'badge-cat-settings';
        else if (log.category === 'USER_MGMT') catClass = 'badge-cat-user';
        else if (log.category === 'OPCUA') catClass = 'badge-cat-opcua';

        let actionClass = 'badge-action-update';
        if (log.action === 'LOGIN') actionClass = 'badge-action-login';
        else if (log.action === 'LOGOUT') actionClass = 'badge-action-logout';
        else if (log.action.includes('FAILED')) actionClass = 'badge-action-failed';
        else if (log.action.includes('RESET')) actionClass = 'badge-action-reset';

        let targetHtml = log.target ? `<span class="audit-target-badge">${escapeHtml(log.target)}</span>` : '<span style="color:#94a3b8;">-</span>';

        let detailsHtml = escapeHtml(log.details || '-');
        if (log.details && (log.details.startsWith('{') || log.details.startsWith('['))) {
            try {
                const parsed = JSON.parse(log.details);
                detailsHtml = `<pre class="audit-details-code">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
            } catch(e) {}
        }

        tr.innerHTML = `
            <td class="audit-cell-time">${dateFormatted}</td>
            <td>
                <span class="audit-cell-user">${escapeHtml(log.username)}</span>
                ${log.role ? `<span class="audit-user-role">${escapeHtml(log.role)}</span>` : ''}
            </td>
            <td><span class="audit-badge ${catClass}">${escapeHtml(log.category)}</span></td>
            <td><span class="audit-badge ${actionClass}">${escapeHtml(log.action)}</span></td>
            <td>${targetHtml}</td>
            <td class="audit-cell-details">${detailsHtml}</td>
            <td class="audit-cell-ip">${escapeHtml(log.ipAddress || '-')}</td>
        `;

        tbody.appendChild(tr);
    });
}

function updateAuditPaginationUI() {
    const pageInfo = document.getElementById('audit-page-info');
    const rangeInfo = document.getElementById('audit-range-info');
    const prevBtn = document.getElementById('audit-prev-btn');
    const nextBtn = document.getElementById('audit-next-btn');
    const firstBtn = document.getElementById('audit-first-btn');
    const lastBtn = document.getElementById('audit-last-btn');

    const curr = auditPagination.currentPage;
    const total = auditPagination.totalPages;
    const count = auditPagination.totalRecords;
    const size = auditPagination.pageSize;

    if (pageInfo) pageInfo.innerText = t('page_x_of_y', { curr, total: total || 1 });

    if (rangeInfo) {
        if (count === 0) {
            rangeInfo.innerText = t('no_records');
        } else {
            const start = (curr - 1) * size + 1;
            const end = Math.min(curr * size, count);
            rangeInfo.innerText = t('showing_rows_range', { start, end, total: count });
        }
    }

    if (prevBtn) prevBtn.disabled = curr <= 1;
    if (firstBtn) firstBtn.disabled = curr <= 1;
    if (nextBtn) nextBtn.disabled = curr >= total;
    if (lastBtn) lastBtn.disabled = curr >= total;
}

function auditChangePage(delta) {
    const targetPage = auditPagination.currentPage + delta;
    if (targetPage >= 1 && targetPage <= auditPagination.totalPages) {
        loadAuditLogs(targetPage);
    }
}

function auditGoToPage(target) {
    if (target === 'last') {
        loadAuditLogs(auditPagination.totalPages);
    } else {
        const page = parseInt(target);
        if (!isNaN(page) && page >= 1 && page <= auditPagination.totalPages) {
            loadAuditLogs(page);
        }
    }
}

function onAuditPageSizeChange() {
    const sel = document.getElementById('audit-page-size');
    if (sel) {
        auditPagination.pageSize = parseInt(sel.value) || 50;
        loadAuditLogs(1);
    }
}

function resetAuditFilters() {
    const cat = document.getElementById('audit-filter-category');
    const tgt = document.getElementById('audit-filter-target');
    const sDate = document.getElementById('audit-filter-start-date');
    const eDate = document.getElementById('audit-filter-end-date');
    const search = document.getElementById('audit-filter-search');

    if (cat) cat.value = '';
    if (tgt) tgt.value = '';
    if (sDate) sDate.value = '';
    if (eDate) eDate.value = '';
    if (search) search.value = '';

    loadAuditLogs(1);
}

function exportAuditLogs() {
    if (!currentUser || !currentUser.accessToken) return;
    const params = getAuditFilterParams(1);
    params.delete('page');
    params.delete('limit');
    params.append('x-access-token', currentUser.accessToken);

    window.open(`/api/audit-logs/export?${params.toString()}`, '_blank');
}

function handleRealtimeAuditLog(entry) {
    const elTotal = document.getElementById('audit-stat-total');
    if (elTotal) {
        const current = parseInt(elTotal.innerText) || 0;
        elTotal.innerText = current + 1;
    }
    if (entry.category === 'AUTH') {
        const elAuth = document.getElementById('audit-stat-auth');
        if (elAuth) elAuth.innerText = (parseInt(elAuth.innerText) || 0) + 1;
    } else if (entry.category === 'CAROUSEL') {
        const elCtrl = document.getElementById('audit-stat-control');
        if (elCtrl) elCtrl.innerText = (parseInt(elCtrl.innerText) || 0) + 1;
    } else if (entry.category === 'SETTINGS') {
        const elSet = document.getElementById('audit-stat-settings');
        if (elSet) elSet.innerText = (parseInt(elSet.innerText) || 0) + 1;
    }

    if (currentView === 'audit' && auditPagination.currentPage === 1) {
        const tbody = document.getElementById('audit-list-body');
        if (tbody) {
            const placeholder = tbody.querySelector('tr td[colspan]');
            if (placeholder) placeholder.parentElement.remove();

            const dt = new Date(entry.createdAt || Date.now());
            const dateFormatted = dt.toLocaleString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/\./g, ':');

            let catClass = 'badge-cat-auth';
            if (entry.category === 'CAROUSEL') catClass = 'badge-cat-carousel';
            else if (entry.category === 'SETTINGS') catClass = 'badge-cat-settings';
            else if (entry.category === 'USER_MGMT') catClass = 'badge-cat-user';
            else if (entry.category === 'OPCUA') catClass = 'badge-cat-opcua';

            let actionClass = 'badge-action-update';
            if (entry.action === 'LOGIN') actionClass = 'badge-action-login';
            else if (entry.action === 'LOGOUT') actionClass = 'badge-action-logout';
            else if (entry.action.includes('FAILED')) actionClass = 'badge-action-failed';
            else if (entry.action.includes('RESET')) actionClass = 'badge-action-reset';

            const tr = document.createElement('tr');
            tr.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
            tr.innerHTML = `
                <td style="font-family: monospace; font-size: 0.82rem; color: #cbd5e1;">${dateFormatted}</td>
                <td>
                    <span style="font-weight:600; color:#f8fafc;">${escapeHtml(entry.username || 'System')}</span>
                    ${entry.role ? `<span class="audit-user-role">${escapeHtml(entry.role)}</span>` : ''}
                </td>
                <td><span class="audit-badge ${catClass}">${escapeHtml(entry.category)}</span></td>
                <td><span class="audit-badge ${actionClass}">${escapeHtml(entry.action)}</span></td>
                <td>${entry.target ? `<span style="font-weight:600; color:#38bdf8;">${escapeHtml(entry.target)}</span>` : '<span style="color:#64748b;">-</span>'}</td>
                <td style="font-size:0.85rem; color:#e2e8f0;">${escapeHtml(entry.details || '-')}</td>
                <td style="font-family: monospace; font-size: 0.8rem; color:#94a3b8;">${escapeHtml(entry.ipAddress || '-')}</td>
            `;

            tbody.insertBefore(tr, tbody.firstChild);

            if (tbody.children.length > auditPagination.pageSize) {
                tbody.lastChild.remove();
            }
        }
    }
}
