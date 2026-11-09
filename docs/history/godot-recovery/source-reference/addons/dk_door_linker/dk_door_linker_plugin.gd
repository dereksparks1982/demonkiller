@tool
extends EditorPlugin

const DK_DIAGNOSTIC_PROBE_META_KEY: StringName = &"dk_project_diagnostic_probe_events_v1"
const DK_DIAGNOSTIC_PROBE_MAX_EVENTS: int = 192

const DoorLinkUtility: GDScript = preload("res://addons/dk_door_linker/dk_door_link_utility.gd")
const DoorLinkInspector: GDScript = preload("res://addons/dk_door_linker/dk_door_linker_inspector.gd")
const DoorLinkContextMenu: GDScript = preload("res://addons/dk_door_linker/dk_door_linker_context_menu.gd")
const DoorLinkPanel: GDScript = preload("res://addons/dk_door_linker/dk_door_linker_panel.gd")

const DK_CELL_ROOT_SCRIPT_PATH: String = "res://scripts/cells/DKCellRoot.gd"
const EDGE_TEST_GROUP: String = "NES_EDGE_TEST_01"
const EDGE_TEST_CELL_SIZE: Vector2 = Vector2(640.0, 400.0)
const EDGE_TEST_SNAP_STEP: Vector2 = Vector2(720.0, 470.0)

var _utility: RefCounted = null
var _inspector_plugin: EditorInspectorPlugin = null
var _context_2d: EditorContextMenuPlugin = null
var _context_scene_tree: EditorContextMenuPlugin = null
var _door_link_panel: Control = null
var _door_link_panel_button: Button = null
var _opening_door_panel: bool = false

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
	_dk_diagnostic_mark("DK Door Linker", "enter_tree_begin")
	_utility = DoorLinkUtility.new()
	_utility.call("setup", get_editor_interface())
	_inspector_plugin = DoorLinkInspector.new()
	_inspector_plugin.call("setup", get_editor_interface(), _utility)
	add_inspector_plugin(_inspector_plugin)
	_context_2d = DoorLinkContextMenu.new()
	_context_2d.call("setup", get_editor_interface(), _utility)
	add_context_menu_plugin(EditorContextMenuPlugin.CONTEXT_SLOT_2D_EDITOR, _context_2d)
	_context_scene_tree = DoorLinkContextMenu.new()
	_context_scene_tree.call("setup", get_editor_interface(), _utility)
	add_context_menu_plugin(EditorContextMenuPlugin.CONTEXT_SLOT_SCENE_TREE, _context_scene_tree)
	add_tool_menu_item("DK Door Linker", Callable(self, "_open_door_linker"))
	add_tool_menu_item("DK: Create Door From Selected Source Door", Callable(self, "_create_door_from_template_from_menu"))
	add_tool_menu_item("DK: Link Selected Doors", Callable(self, "_link_selected_doors_from_menu"))
	add_tool_menu_item("DK: Clear Selected Door Links", Callable(self, "_clear_selected_door_links_from_menu"))
	add_tool_menu_item("DK: Link Selected Cells", Callable(self, "_link_selected_cells_from_menu"))
	add_tool_menu_item("DK: Clear Selected Cell Links", Callable(self, "_clear_selected_cell_links_from_menu"))
	add_tool_menu_item("DK: Create NES Edge Test Cells", Callable(self, "_create_nes_edge_test_cells_from_menu"))
	_ensure_door_linker_panel()
	_dk_diagnostic_mark("DK Door Linker", "enter_tree_end")
	print("DK Door Linker plugin initialised with visible bottom-panel content repair.")


func _exit_tree() -> void:
	remove_tool_menu_item("DK Door Linker")
	remove_tool_menu_item("DK: Create Door From Selected Source Door")
	remove_tool_menu_item("DK: Link Selected Doors")
	remove_tool_menu_item("DK: Clear Selected Door Links")
	remove_tool_menu_item("DK: Link Selected Cells")
	remove_tool_menu_item("DK: Clear Selected Cell Links")
	remove_tool_menu_item("DK: Create NES Edge Test Cells")
	if _door_link_panel_button != null and is_instance_valid(_door_link_panel_button):
		var press_callable: Callable = Callable(self, "_open_door_linker")
		if _door_link_panel_button.pressed.is_connected(press_callable):
			_door_link_panel_button.pressed.disconnect(press_callable)
	if _door_link_panel != null and is_instance_valid(_door_link_panel):
		remove_control_from_bottom_panel(_door_link_panel)
		_door_link_panel.queue_free()
	_door_link_panel = null
	_door_link_panel_button = null
	_opening_door_panel = false
	if _context_2d != null:
		remove_context_menu_plugin(_context_2d)
		_context_2d = null
	if _context_scene_tree != null:
		remove_context_menu_plugin(_context_scene_tree)
		_context_scene_tree = null
	if _inspector_plugin != null:
		remove_inspector_plugin(_inspector_plugin)
		_inspector_plugin = null
	_utility = null


func _ensure_door_linker_panel() -> void:
	if _door_link_panel != null and is_instance_valid(_door_link_panel):
		return
	_door_link_panel = DoorLinkPanel.new()
	_door_link_panel.name = "DKDoorLinkerPanel"
	_door_link_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_door_link_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_door_link_panel.call("setup", get_editor_interface(), _utility)
	_door_link_panel_button = add_control_to_bottom_panel(_door_link_panel, "DK Door Linker")
	if _door_link_panel_button == null:
		push_error("DK Door Linker bottom-panel button failed to register.")
	else:
		_door_link_panel_button.tooltip_text = "Open DK Door Linker"
		var press_callable: Callable = Callable(self, "_open_door_linker")
		if not _door_link_panel_button.pressed.is_connected(press_callable):
			_door_link_panel_button.pressed.connect(press_callable)


func _open_door_linker() -> void:
	if _opening_door_panel:
		return
	_opening_door_panel = true
	_ensure_door_linker_panel()
	if _door_link_panel == null or not is_instance_valid(_door_link_panel):
		_opening_door_panel = false
		push_error("DK Door Linker panel failed to initialise.")
		return
	if _door_link_panel.has_method("refresh_project_context"):
		_door_link_panel.call("refresh_project_context")
	elif _door_link_panel.has_method("refresh"):
		_door_link_panel.call("refresh")
	_door_link_panel.show()
	make_bottom_panel_item_visible(_door_link_panel)
	_door_link_panel.grab_focus()
	print("DK Door Linker bottom-panel content opened.")
	call_deferred("_finish_open_door_linker")


func _finish_open_door_linker() -> void:
	if _door_link_panel != null and is_instance_valid(_door_link_panel):
		_door_link_panel.show()
		make_bottom_panel_item_visible(_door_link_panel)
	_opening_door_panel = false


func _create_door_from_template_from_menu() -> void:
	if _utility != null:
		_utility.call("create_door_from_selected_template")

func _link_selected_doors_from_menu() -> void:
	if _utility != null:
		_utility.call("link_selected_doors")

func _clear_selected_door_links_from_menu() -> void:
	if _utility != null:
		_utility.call("clear_selected_door_links")

func _link_selected_cells_from_menu() -> void:
	if _utility != null:
		_utility.call("link_selected_cells")

func _clear_selected_cell_links_from_menu() -> void:
	if _utility != null:
		_utility.call("clear_selected_cell_links")

func _create_nes_edge_test_cells_from_menu() -> void:
	var edited_root: Node = get_editor_interface().get_edited_scene_root()
	if edited_root == null:
		push_warning("DK Edge Test Cells: open Main.tscn first.")
		return
	var cells_root: Node = edited_root.get_node_or_null("Cells")
	if cells_root == null:
		push_warning("DK Edge Test Cells: edited scene has no Cells root.")
		return
	var existing_a: Node = cells_root.get_node_or_null("CellU")
	var existing_b: Node = cells_root.get_node_or_null("CellV")
	if existing_a != null or existing_b != null:
		_configure_world_for_edge_test(edited_root)
		_select_existing_edge_test_cells(existing_a, existing_b)
		push_warning("DK Edge Test Cells: pair already exists. Selected existing cells and configured Main to start there.")
		return
	var base_position: Vector2 = _find_edge_test_base_position(cells_root)
	var undo: EditorUndoRedoManager = get_undo_redo()
	var cell_a: Node2D = _make_edge_test_cell("CellU", "Cell U / NES Edge Test A", base_position, Color(0.16, 0.19, 0.14, 1.0), false, true, edited_root)
	var cell_b: Node2D = _make_edge_test_cell("CellV", "Cell V / NES Edge Test B", base_position + Vector2(EDGE_TEST_SNAP_STEP.x, 0.0), Color(0.14, 0.18, 0.21, 1.0), true, false, edited_root)
	undo.create_action("DK Create NES Edge Test Cells")
	undo.add_do_method(cells_root, "add_child", cell_a)
	undo.add_do_method(cell_a, "set_owner", edited_root)
	undo.add_do_method(self, "_assign_owner_recursive", cell_a, edited_root)
	undo.add_do_method(cells_root, "add_child", cell_b)
	undo.add_do_method(cell_b, "set_owner", edited_root)
	undo.add_do_method(self, "_assign_owner_recursive", cell_b, edited_root)
	if edited_root.has_method("set"):
		undo.add_do_method(edited_root, "set", "nes_edge_test_auto_start_enabled", true)
		undo.add_do_method(edited_root, "set", "nes_edge_test_auto_create_runtime_pair", true)
		undo.add_do_method(edited_root, "set", "start_cell_name", "CellU")
		undo.add_do_method(edited_root, "set", "start_spawn_position", Vector2(320.0, 200.0))
		undo.add_do_method(edited_root, "set", "start_display_name", "Cell U / NES Edge Test A")
	undo.add_undo_method(cells_root, "remove_child", cell_a)
	undo.add_undo_method(cells_root, "remove_child", cell_b)
	undo.commit_action()
	get_editor_interface().mark_scene_as_unsaved()
	_select_existing_edge_test_cells(cell_a, cell_b)
	print("DK Edge Test Cells created: CellU <-> CellV. They are separate from the main map and use DKCellRoot snap logic.")

func _configure_world_for_edge_test(edited_root: Node) -> void:
	if edited_root == null:
		return
	edited_root.set("nes_edge_test_auto_start_enabled", true)
	edited_root.set("nes_edge_test_auto_create_runtime_pair", true)
	edited_root.set("start_cell_name", "CellU")
	edited_root.set("start_spawn_position", Vector2(320.0, 200.0))
	edited_root.set("start_display_name", "Cell U / NES Edge Test A")

func _find_edge_test_base_position(cells_root: Node) -> Vector2:
	var used_keys: Dictionary = {}
	var lowest_grid_y: int = 0
	for child: Node in cells_root.get_children():
		if not child is Node2D or not str(child.name).begins_with("Cell"):
			continue
		var cell_position: Vector2 = (child as Node2D).position
		var grid_x: int = int(roundf(cell_position.x / EDGE_TEST_SNAP_STEP.x))
		var grid_y: int = int(roundf(cell_position.y / EDGE_TEST_SNAP_STEP.y))
		used_keys[str(grid_x) + "," + str(grid_y)] = true
		lowest_grid_y = maxi(lowest_grid_y, grid_y)
	var target_y: int = lowest_grid_y + 2
	var target_x: int = 0
	while used_keys.has(str(target_x) + "," + str(target_y)) or used_keys.has(str(target_x + 1) + "," + str(target_y)):
		target_y += 1
	return Vector2(target_x * EDGE_TEST_SNAP_STEP.x, target_y * EDGE_TEST_SNAP_STEP.y)

func _make_edge_test_cell(cell_name: String, display_name: String, cell_position: Vector2, floor_colour: Color, open_west: bool, open_east: bool, edited_root: Node) -> Node2D:
	var cell: Node2D = Node2D.new()
	cell.name = cell_name
	cell.position = cell_position
	var cell_script: Script = load(DK_CELL_ROOT_SCRIPT_PATH) as Script
	if cell_script != null:
		cell.set_script(cell_script)
		cell.set("editor_cell_snap_enabled", true)
		cell.set("editor_cell_snap_step", EDGE_TEST_SNAP_STEP)
		cell.set("editor_force_same_cell_draw_level", true)
	cell.set_meta("display_name", display_name)
	cell.set_meta("dk_edge_transition_enabled", true)
	cell.set_meta("dk_edge_transition_group", EDGE_TEST_GROUP)
	cell.set_meta("dk_editor_position", cell_position)
	cell.set_meta("dk_grid_key", _grid_key_for_position(cell_position))
	cell.set_meta("dk_same_draw_level", true)
	cell.set_meta("dk_draw_z_index", 0)
	_add_cell_floor(cell, floor_colour)
	_add_cell_label(cell, display_name)
	_add_cell_wall(cell, "WallTop", Vector2(EDGE_TEST_CELL_SIZE.x * 0.5, -12.0), Vector2(EDGE_TEST_CELL_SIZE.x, 24.0))
	_add_cell_wall(cell, "WallBottom", Vector2(EDGE_TEST_CELL_SIZE.x * 0.5, EDGE_TEST_CELL_SIZE.y + 12.0), Vector2(EDGE_TEST_CELL_SIZE.x, 24.0))
	if not open_west:
		_add_cell_wall(cell, "WallLeft", Vector2(-12.0, EDGE_TEST_CELL_SIZE.y * 0.5), Vector2(24.0, EDGE_TEST_CELL_SIZE.y))
	if not open_east:
		_add_cell_wall(cell, "WallRight", Vector2(EDGE_TEST_CELL_SIZE.x + 12.0, EDGE_TEST_CELL_SIZE.y * 0.5), Vector2(24.0, EDGE_TEST_CELL_SIZE.y))
	_assign_owner_recursive(cell, edited_root)
	return cell

func _add_cell_floor(cell: Node2D, floor_colour: Color) -> void:
	var floor: ColorRect = ColorRect.new()
	floor.name = "Floor"
	floor.offset_right = EDGE_TEST_CELL_SIZE.x
	floor.offset_bottom = EDGE_TEST_CELL_SIZE.y
	floor.color = floor_colour
	floor.set_meta("dk_protected", true)
	cell.add_child(floor)

func _add_cell_label(cell: Node2D, display_name: String) -> void:
	var label: Label = Label.new()
	label.name = "Label"
	label.offset_left = 20.0
	label.offset_top = 16.0
	label.offset_right = 440.0
	label.offset_bottom = 52.0
	label.text = display_name + " - walk through the shared edge"
	label.set_meta("dk_protected", true)
	cell.add_child(label)

func _add_cell_wall(cell: Node2D, wall_name: String, wall_position: Vector2, wall_size: Vector2) -> void:
	var wall: StaticBody2D = StaticBody2D.new()
	wall.name = wall_name
	wall.position = wall_position
	wall.set_meta("dk_protected", true)
	var shape_node: CollisionShape2D = CollisionShape2D.new()
	shape_node.name = "CollisionShape2D"
	var shape: RectangleShape2D = RectangleShape2D.new()
	shape.size = wall_size
	shape_node.shape = shape
	shape_node.set_meta("dk_protected", true)
	wall.add_child(shape_node)
	cell.add_child(wall)

func _assign_owner_recursive(node: Node, edited_root: Node) -> void:
	if node == null or edited_root == null:
		return
	if node != edited_root:
		node.owner = edited_root
	for child: Node in node.get_children():
		_assign_owner_recursive(child, edited_root)

func _select_existing_edge_test_cells(cell_a: Node, cell_b: Node) -> void:
	var selection: EditorSelection = get_editor_interface().get_selection()
	selection.clear()
	if cell_a != null:
		selection.add_node(cell_a)
	if cell_b != null:
		selection.add_node(cell_b)

func _grid_key_for_position(source_position: Vector2) -> String:
	var gx: int = int(roundf(source_position.x / EDGE_TEST_SNAP_STEP.x))
	var gy: int = int(roundf(source_position.y / EDGE_TEST_SNAP_STEP.y))
	return str(gx) + "," + str(gy)
