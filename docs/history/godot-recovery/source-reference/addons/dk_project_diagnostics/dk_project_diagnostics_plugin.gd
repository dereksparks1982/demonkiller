@tool
extends EditorPlugin

const StartupProbe: GDScript = preload(
	"res://addons/dk_project_diagnostics/dk_startup_diagnostic_probe.gd"
)
const DiagnosticSession: GDScript = preload(
	"res://addons/dk_project_diagnostics/dk_project_diagnostics_session.gd"
)
const DiagnosticPanel: GDScript = preload(
	"res://addons/dk_project_diagnostics/dk_project_diagnostics_panel.gd"
)

var _session: Node = null
var _panel: Control = null
var _panel_button: Button = null
var _opening_panel: bool = false


func _enter_tree() -> void:
	StartupProbe.mark("DK Project Diagnostic Scanner", "enter_tree_begin")
	_session = DiagnosticSession.new()
	_session.name = "DKProjectDiagnosticSession"
	add_child(_session)
	_session.call("setup", get_editor_interface())
	_panel = DiagnosticPanel.new()
	_panel.name = "DKProjectDiagnosticScannerPanel"
	_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_panel.call("setup", _session)
	_panel_button = add_control_to_bottom_panel(_panel, "DK Diagnostics")
	if _panel_button != null:
		_panel_button.tooltip_text = "Open DK Project Diagnostic Scanner"
		var press_callable: Callable = Callable(self, "_open_diagnostics")
		if not _panel_button.pressed.is_connected(press_callable):
			_panel_button.pressed.connect(press_callable)
	else:
		push_error("DK Project Diagnostic Scanner bottom-panel button failed to register.")
	add_tool_menu_item("DK Project Diagnostic Scanner", Callable(self, "_open_diagnostics"))
	var scene_callable: Callable = Callable(self, "_on_editor_scene_changed")
	if not scene_changed.is_connected(scene_callable):
		scene_changed.connect(scene_callable)
	var probe_details: Dictionary = {"panel_registered": _panel_button != null}
	StartupProbe.mark("DK Project Diagnostic Scanner", "enter_tree_end", probe_details)
	_session.call("refresh_probe_events")
	print("DK Project Diagnostic Scanner v0.1.2 started passive editor diagnostics with self-noise filtering and engine-log integrity checks.")


func _exit_tree() -> void:
	StartupProbe.mark("DK Project Diagnostic Scanner", "exit_tree_begin")
	remove_tool_menu_item("DK Project Diagnostic Scanner")
	var scene_callable: Callable = Callable(self, "_on_editor_scene_changed")
	if scene_changed.is_connected(scene_callable):
		scene_changed.disconnect(scene_callable)
	if _panel_button != null and is_instance_valid(_panel_button):
		var press_callable: Callable = Callable(self, "_open_diagnostics")
		if _panel_button.pressed.is_connected(press_callable):
			_panel_button.pressed.disconnect(press_callable)
	if _panel != null and is_instance_valid(_panel):
		if _panel.has_method("shutdown"):
			_panel.call("shutdown")
		remove_control_from_bottom_panel(_panel)
		_panel.queue_free()
	if _session != null and is_instance_valid(_session):
		if _session.has_method("shutdown"):
			_session.call("shutdown")
		_session.queue_free()
	_panel = null
	_panel_button = null
	_session = null
	_opening_panel = false
	StartupProbe.mark("DK Project Diagnostic Scanner", "exit_tree_end")


func _open_diagnostics() -> void:
	if _opening_panel:
		return
	_opening_panel = true
	if _panel == null or not is_instance_valid(_panel):
		_opening_panel = false
		push_error("DK Project Diagnostic Scanner panel is unavailable.")
		return
	_panel.show()
	make_bottom_panel_item_visible(_panel)
	_panel.grab_focus()
	call_deferred("_finish_open_diagnostics")


func _finish_open_diagnostics() -> void:
	if _panel != null and is_instance_valid(_panel):
		_panel.show()
		make_bottom_panel_item_visible(_panel)
	_opening_panel = false


func _on_editor_scene_changed(scene_root: Node) -> void:
	if _session != null and is_instance_valid(_session):
		_session.call("note_scene_changed", scene_root)
