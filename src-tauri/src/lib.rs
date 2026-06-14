use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code,
    GlobalShortcutExt,
    Modifiers,
    Shortcut,
    ShortcutState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let visibility_shortcut = Shortcut::new(
                    Some(Modifiers::CONTROL | Modifiers::ALT),
                    Code::KeyD,
                );

                let floating_shortcut = Shortcut::new(
                    Some(Modifiers::CONTROL | Modifiers::ALT),
                    Code::KeyT,
                );

                let visibility_handler = visibility_shortcut.clone();
                let floating_handler = floating_shortcut.clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app_handle, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }

                            if shortcut == &visibility_handler {
                                if let Some(window) =
                                    app_handle.get_webview_window("main")
                                {
                                    match window.is_visible() {
                                        Ok(true) => {
                                            let _ = window.hide();
                                        }
                                        _ => {
                                            let _ = window.show();
                                            let _ = window.unminimize();
                                            let _ = window.set_focus();
                                        }
                                    }
                                }

                                return;
                            }

                            if shortcut == &floating_handler {
                                if let Some(window) =
                                    app_handle.get_webview_window("main")
                                {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }

                                let _ = app_handle.emit(
                                    "toggle-floating-mode",
                                    (),
                                );
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(visibility_shortcut)?;
                app.global_shortcut().register(floating_shortcut)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行待办应用失败");
}
