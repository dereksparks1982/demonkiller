extends Node

signal faith_changed(value: int)

const MIN_FAITH: int = 0

var _faith: int = MIN_FAITH


func get_faith() -> int:
	return _faith


func set_faith(value: int) -> void:
	var next_value: int = maxi(value, MIN_FAITH)
	if next_value == _faith:
		return
	_faith = next_value
	faith_changed.emit(_faith)


func add_faith(amount: int) -> int:
	if amount <= 0:
		return _faith
	set_faith(_faith + amount)
	return _faith


func can_spend_faith(amount: int) -> bool:
	return amount >= 0 and _faith >= amount


func spend_faith(amount: int) -> bool:
	if amount <= 0 or not can_spend_faith(amount):
		return false
	set_faith(_faith - amount)
	return true
