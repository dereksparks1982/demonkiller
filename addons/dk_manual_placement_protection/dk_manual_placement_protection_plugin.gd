@tool
extends EditorPlugin

const DK_SEAMLESS_PROP_PROTECTION_BUTTON_PANEL_COMPILE_REPAIR_CONTRACT: String = "DK_SEAMLESS_PROP_PROTECTION_BUTTON_PANEL_COMPILE_REPAIR_CONTRACT"
const DK_SEAMLESS_PROP_PROTECTION_BOTTOM_PANEL_DOCK_REPAIR_CONTRACT: String = "DK_SEAMLESS_PROP_PROTECTION_BOTTOM_PANEL_DOCK_REPAIR_CONTRACT"
const PANEL_SCRIPT = preload("res://addons/dk_manual_placement_protection/dk_manual_placement_protection_panel.gd")

var _placement_panel: Control = null
var _bottom_panel_button: Button = null


func _enter_tree() -> void:
	_ensure_panel()
	print("DK Manual Placement Protection bottom panel initialised. Existing DK protected/user-placed metadata is authoritative.")


func _exit_tree() -> void:
	if _placement_panel != null and is_instance_valid(_placement_panel):
		remove_control_from_bottom_panel(_placement_panel)
		_placement_panel.queue_free()
	_placement_panel = null
	_bottom_panel_button = null


func _ensure_panel() -> void:
	if _placement_panel != null and is_instance_valid(_placement_panel):
		return
	_placement_panel = PANEL_SCRIPT.new()
	_placement_panel.name = "DKManualPlacementProtectionPanel"
	_placement_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_placement_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_placement_panel.call("setup", get_editor_interface())
	_bottom_panel_button = add_control_to_bottom_panel(_placement_panel, "DK Placement Protection")
	make_bottom_panel_item_visible(_placement_panel)


func get_manual_placement_protection_contract() -> Dictionary:
	return {
		"contract_id": DK_SEAMLESS_PROP_PROTECTION_BOTTOM_PANEL_DOCK_REPAIR_CONTRACT,
		"version": "0.4.93",
		"panel": true,
		"bottom_panel_dock": true,
		"inspector_dock": false,
		"buttons_not_commands": true,
		"uses_existing_dk_protection_metadata": true,
		"metadata_keys": ["dk_protected", "dk_user_placed", "dk_owner", "dk_generated"],
		"position_snapshot_metadata": true,
		"json_ledger": false,
		"runtime_player_save_state": false,
		"changes_gameplay_input": false,
	}
