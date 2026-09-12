@tool
extends EditorPlugin

const TARGET_MAIN_SCREEN: String = "2D"
const ENFORCE_PASSES: int = 3
const DK_2D_EDITOR_STARTUP_GUARD_CONTRACT: String = "DK_2D_EDITOR_STARTUP_GUARD_CONTRACT"

var _passes_done: int = 0


func _enter_tree() -> void:
	_passes_done = 0
	call_deferred("_force_2d_editor_startup")


func _exit_tree() -> void:
	_passes_done = ENFORCE_PASSES


func _force_2d_editor_startup() -> void:
	if not Engine.is_editor_hint():
		return
	var editor_interface: EditorInterface = get_editor_interface()
	if editor_interface != null:
		editor_interface.set_main_screen_editor(TARGET_MAIN_SCREEN)
	_passes_done += 1
	if _passes_done < ENFORCE_PASSES:
		call_deferred("_force_2d_editor_startup")


func get_editor_startup_2d_guard_contract() -> Dictionary:
	return {
		"contract": DK_2D_EDITOR_STARTUP_GUARD_CONTRACT,
		"target_main_screen": TARGET_MAIN_SCREEN,
		"enforce_passes": ENFORCE_PASSES,
		"uses_editor_interface_set_main_screen_editor": true,
		"creates_background_process": false,
		"changes_runtime_zoom": false,
	}
