@tool
class_name DKDesignatedSavePoint
extends Node2D

const DK_DESIGNATED_SAVE_POINT_RUNTIME_CONTRACT: String = "DK_DESIGNATED_SAVE_POINT_RUNTIME_CONTRACT"
const DK_SAVE_POINT_RUNTIME_VISIBILITY_AND_WARNING_REPAIR_CONTRACT: String = "DK_SAVE_POINT_RUNTIME_VISIBILITY_AND_WARNING_REPAIR_CONTRACT"
const DK_DESIGNATED_SAVE_POINT_SCENE_PATH: String = "res://scenes/world/DKDesignatedSavePoint.tscn"

@export var save_point_id: String = "B2_SANCTUARY_SAVE_SHRINE_001"
@export var display_name: String = "Sanctuary Save Shrine"
@export var click_radius: float = 52.0
@export var interaction_range: float = 176.0
@export_range(0.1, 0.75, 0.01) var double_click_window: float = 0.32
@export var single_click_text: String = "Double-left-click the Sanctuary Save Shrine to save your character checkpoint."

var _selected: bool = false
var _hovered: bool = false
var _last_interact_msec: int = -1000000
var _last_interactor_id: int = 0

func _ready() -> void:
	_set_save_point_surface_metadata()
	force_runtime_surface_visible()
	if Engine.is_editor_hint():
		return
	add_to_group("dk_clickable")
	add_to_group("dk_designated_save_point")


func _set_save_point_surface_metadata() -> void:
	set_meta("dk_designated_save_point", true)
	set_meta("dk_save_point_id", save_point_id)
	set_meta("dk_save_anywhere_enabled", false)
	set_meta("dk_save_shrine_preview_play_surface_parity_v0_4_89", true)
	set_meta("dk_same_preview_runtime_scene_surface", true)
	set_meta("dk_preview_scene_path", DK_DESIGNATED_SAVE_POINT_SCENE_PATH)
	set_meta("dk_runtime_scene_path", DK_DESIGNATED_SAVE_POINT_SCENE_PATH)


func force_runtime_surface_visible() -> void:
	visible = true
	z_index = maxi(z_index, 72)
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	set_meta("dk_save_point_runtime_visibility_repair_v0_4_89", true)
	set_meta("dk_save_point_runtime_visible_surface", true)
	queue_redraw()

func get_display_name() -> String:
	return display_name

func get_click_radius() -> float:
	return maxf(click_radius, 1.0)

func get_interaction_range() -> float:
	return maxf(interaction_range, 1.0)

func set_selected(value: bool) -> void:
	_selected = value
	queue_redraw()

func set_hovered(value: bool) -> void:
	_hovered = value
	queue_redraw()

func interact(player: Node) -> void:
	var now: int = Time.get_ticks_msec()
	var interactor_id: int = player.get_instance_id() if player != null else 0
	var elapsed: float = float(now - _last_interact_msec) / 1000.0
	var is_double: bool = interactor_id == _last_interactor_id and elapsed <= double_click_window
	_last_interact_msec = now
	_last_interactor_id = interactor_id
	if is_double:
		_last_interact_msec = -1000000
		perform_save(player)
		return
	_show_player_status(player, single_click_text)

func perform_save(player: Node, path: String = "") -> Dictionary:
	if player == null or not player is Node2D:
		return {"ok": false, "reason": "A player is required at the save point."}
	var player_2d: Node2D = player as Node2D
	if player_2d.global_position.distance_to(global_position) > get_interaction_range():
		var range_message: String = "Move closer to the Sanctuary Save Shrine."
		_show_player_status(player, range_message)
		return {"ok": false, "reason": range_message, "out_of_range": true}
	var world: Node = _find_save_controller()
	if world == null:
		var missing_message: String = "The designated save controller is unavailable."
		_show_player_status(player, missing_message)
		return {"ok": false, "reason": missing_message}
	var result: Dictionary = world.call("designated_save_single_slot", save_point_id, display_name, path) as Dictionary
	_show_player_status(player, str(result.get("message", result.get("reason", ""))))
	return result

func get_runtime_contract() -> Dictionary:
	return {
		"runtime_contract": DK_DESIGNATED_SAVE_POINT_RUNTIME_CONTRACT,
		"save_point_id": save_point_id,
		"display_name": display_name,
		"designated": true,
		"save_anywhere_enabled": false,
		"interaction_range": get_interaction_range(),
		"double_click_required": true,
		"save_shrine_surface_parity_contract": DK_SAVE_POINT_RUNTIME_VISIBILITY_AND_WARNING_REPAIR_CONTRACT,
		"same_preview_runtime_scene_surface": true,
		"runtime_visibility_repair": true,
		"visible_surface_z_index_minimum": 72,
	}


func get_preview_play_surface_contract() -> Dictionary:
	return {
		"contract": DK_SAVE_POINT_RUNTIME_VISIBILITY_AND_WARNING_REPAIR_CONTRACT,
		"save_point_id": save_point_id,
		"preview_scene_path": DK_DESIGNATED_SAVE_POINT_SCENE_PATH,
		"runtime_scene_path": DK_DESIGNATED_SAVE_POINT_SCENE_PATH,
		"same_surface": true,
		"fake_preview_marker_removed": true,
		"save_anywhere_enabled": false,
		"runtime_visibility_repair": true,
		"visible_surface_z_index_minimum": 72,
	}

func _find_save_controller() -> Node:
	var candidate: Node = get_parent()
	while candidate != null:
		if candidate.has_method("designated_save_single_slot"):
			return candidate
		candidate = candidate.get_parent()
	var current_scene: Node = get_tree().current_scene
	if current_scene != null and current_scene.has_method("designated_save_single_slot"):
		return current_scene
	return null

func _show_player_status(player: Node, text: String) -> void:
	if player != null and player.has_method("set_status_text") and not text.is_empty():
		player.call("set_status_text", text)

func _draw() -> void:
	var stone_fill: Color = Color(0.18, 0.24, 0.30, 1.0)
	var rune_fill: Color = Color(0.42, 0.82, 0.96, 1.0)
	var edge: Color = Color(0.08, 0.10, 0.12, 1.0)
	draw_circle(Vector2.ZERO, 42.0, Color(0.42, 0.82, 0.96, 0.16), true)
	draw_circle(Vector2.ZERO, 42.0, rune_fill, false, 3.0)
	draw_rect(Rect2(-30.0, -22.0, 60.0, 44.0), stone_fill, true)
	draw_rect(Rect2(-30.0, -22.0, 60.0, 44.0), edge, false, 3.0)
	draw_line(Vector2(-13.0, 0.0), Vector2(13.0, 0.0), rune_fill, 4.0)
	draw_line(Vector2(0.0, -13.0), Vector2(0.0, 13.0), rune_fill, 4.0)
	draw_circle(Vector2.ZERO, 17.0, rune_fill, false, 2.0)
	if _selected or _hovered:
		draw_rect(Rect2(-37.0, -29.0, 74.0, 58.0), Color(0.86, 0.94, 1.0, 0.95), false, 2.0)
	draw_string(ThemeDB.fallback_font, Vector2(-28.0, 42.0), "SAVE", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 14, rune_fill)
	draw_string(ThemeDB.fallback_font, Vector2(-58.0, 62.0), "SAVE SHRINE", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 12, rune_fill)
