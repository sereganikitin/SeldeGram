fn main() {
    // tauri_build по умолчанию не отслеживает наши permission-файлы и
    // capability-конфиги — без явного rerun-if-changed Cargo пропускает
    // их при инкрементальной сборке и старый ACL остаётся в бинаре.
    println!("cargo:rerun-if-changed=permissions");
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    tauri_build::build()
}
