@tool
extends EditorPlugin

const DK_DIAGNOSTIC_PROBE_META_KEY: StringName = &"dk_project_diagnostic_probe_events_v1"
const DK_DIAGNOSTIC_PROBE_MAX_EVENTS: int = 192

const LiveBuilderPanel: GDScript = preload("res://addons/dk_live_builder/dk_live_builder_panel.gd")

var _panel: Control = null
var _panel_button: Button = null
var _opening_panel: bool = false

func _dk_diagnostic_mark(source: String, phase: String, details: Dictionary = {}) -> void:
	var events: Array = []
	var stored: Variant = Engine.get_meta(DK_DIAGNOSTIC_PROBE_META_KEY, [])
	if stored is Array:
		events = (stored as Array).duplicate(true)
	events.append(
		{
			"ticks_usec": Time.get_ticks_usec(),
			"source": source,
			"phase": phase,
			"details": details.duplicate(true),
		}
	)
	while events.size() > DK_DIAGNOSTIC_PROBE_MAX_EVENTS:
		events.pop_front()
	Engine.set_meta(DK_DIAGNOSTIC_PROBE_META_KEY, events)



func _enter_tree() -> void:
	_dk_diagnostic_mark("DK Live Builder", "enter_tree_begin")
	_ensure_live_builder_panel()
	add_tool_menu_item("DK Live Builder", Callable(self, "_open_live_builder"))
	_dk_diagnostic_mark("DK Live Builder", "enter_tree_end")
	print("DK Live Builder plugin initialised with visible bottom-panel content and manifest repair.")


func _exit_tree() -> void:
	remove_tool_menu_item("DK Live Builder")
	if _panel_button != null and is_instance_valid(_panel_button):
		var press_callable: Callable = Callable(self, "_open_live_builder")
		if _panel_button.pressed.is_connected(press_callable):
			_panel_button.pressed.disconnect(press_callable)
	if _panel != null and is_instance_valid(_panel):
		if _panel.has_method("shutdown"):
			_panel.call("shutdown")
		remove_control_from_bottom_panel(_panel)
		_panel.queue_free()
	_panel = null
	_panel_button = null
	_opening_panel = false


func _ensure_live_builder_panel() -> void:
	if _panel != null and is_instance_valid(_panel):
		return
	_panel = LiveBuilderPanel.new()
	_panel.name = "DKLiveBuilderPanel"
	_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_panel.call("setup", get_editor_interface())
	_panel.show()
	_panel_button = add_control_to_bottom_panel(_panel, "DK Live Builder")
	if _panel_button == null:
		push_error("DK Live Builder bottom-panel button failed to register.")
	else:
		_panel_button.tooltip_text = "Open DK Live Builder"
		var press_callable: Callable = Callable(self, "_open_live_builder")
		if not _panel_button.pressed.is_connected(press_callable):
			_panel_button.pressed.connect(press_callable)


func _open_live_builder() -> void:
	if _opening_panel:
		return
	_opening_panel = true
	_ensure_live_builder_panel()
	if _panel == null or not is_instance_valid(_panel):
		_opening_panel = false
		push_error("DK Live Builder panel failed to initialise.")
		return
	if _panel.has_method("refresh_project_context"):
		_panel.call("refresh_project_context")
	_panel.show()
	make_bottom_panel_item_visible(_panel)
	_panel.grab_focus()
	print("DK Live Builder bottom-panel content opened.")
	call_deferred("_finish_open_live_builder")


func _finish_open_live_builder() -> void:
	_reveal_live_builder_panel()
	call_deferred("_reveal_live_builder_panel")
	_opening_panel = false


func _reveal_live_builder_panel() -> void:
	if _panel != null and is_instance_valid(_panel):
		_panel.visible = true
		_panel.show()
		make_bottom_panel_item_visible(_panel)
