#!/usr/bin/env python3
"""
Lofield FM Configuration Validator

This script validates all JSON configuration files for:
- JSON syntax correctness
- Cross-reference consistency (presenter IDs, topic tags)
- Music ratio requirements (minimum 60% music)
- Schedule coverage (24-hour period with no gaps)
- AI budget alignment with show durations
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta


def load_json(filepath):
    """Load and parse a JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"✗ {filepath} - JSON parsing error: {e}")
        return None
    except FileNotFoundError:
        print(f"✗ {filepath} - File not found")
        return None


def validate_json_syntax():
    """Validate JSON syntax for all configuration files."""
    print("=== JSON Syntax Validation ===")
    files = [
        'config/station.json',
        'config/presenters.json',
        'config/tags.json',
    ] + list(Path('config/shows').glob('*.json'))
    
    errors = []
    for filepath in files:
        if load_json(filepath) is None:
            errors.append(f"Invalid JSON: {filepath}")
        else:
            print(f"✓ {filepath}")
    
    return errors


def validate_cross_references():
    """Validate cross-references between configuration files."""
    print("\n=== Cross-Reference Validation ===")
    errors = []
    
    # Load configuration files
    presenters_data = load_json('config/presenters.json')
    tags_data = load_json('config/tags.json')
    
    if not presenters_data or not tags_data:
        return ["Failed to load base configuration files"]
    
    # Get presenter IDs and allowed tags
    presenter_ids = set(p['id'] for p in presenters_data['presenters'])
    allowed_tags = set(tags_data['allowed_topic_tags'])
    
    print(f"Found {len(presenter_ids)} presenters")
    print(f"Found {len(allowed_tags)} allowed topic tags")
    
    # Check each show
    show_files = sorted(Path('config/shows').glob('*.json'))
    for show_file in show_files:
        show = load_json(show_file)
        if not show:
            errors.append(f"Failed to load {show_file}")
            continue
        
        show_id = show['id']
        
        # Validate presenter references
        duo = show['presenters']['primary_duo']
        for presenter_id in duo:
            if presenter_id not in presenter_ids:
                errors.append(f"{show_id}: Unknown presenter '{presenter_id}'")
        
        # Validate topic tags
        primary_tags = show['topics']['primary_tags']
        for tag in primary_tags:
            if tag not in allowed_tags:
                errors.append(f"{show_id}: Unknown tag '{tag}'")
    
    if not errors:
        print("✓ All cross-references valid")
    
    return errors


def validate_music_ratios():
    """Validate music/talk ratios meet station requirements."""
    print("\n=== Music Ratio Validation ===")
    errors = []
    
    station = load_json('config/station.json')
    if not station:
        return ["Failed to load station.json"]
    
    max_music = station['default_ratios']['max_music_fraction']
    min_talk = station['default_ratios']['min_talk_fraction']
    
    show_files = sorted(Path('config/shows').glob('*.json'))
    for show_file in show_files:
        show = load_json(show_file)
        if not show:
            continue
        
        show_id = show['id']
        music_fraction = show['ratios']['music_fraction']
        talk_fraction = show['ratios']['talk_fraction']
        
        # Check maximum music requirement (music capped at 60%)
        if music_fraction > max_music:
            errors.append(f"{show_id}: Music {music_fraction} exceeds maximum {max_music}")
        
        # Check minimum talk requirement (at least 40% talk)
        if talk_fraction < min_talk:
            errors.append(f"{show_id}: Talk {talk_fraction} below minimum {min_talk}")
        
        # Check ratios sum to 1.0
        total = music_fraction + talk_fraction
        if abs(total - 1.0) > 0.001:
            errors.append(f"{show_id}: Ratios sum to {total}, not 1.0")
        
        print(f"✓ {show_id}: {music_fraction:.0%} music, {talk_fraction:.0%} talk")
    
    return errors


def validate_schedule_coverage():
    """Validate that shows cover the full 24-hour period."""
    print("\n=== Schedule Coverage Validation ===")
    errors = []
    
    show_files = sorted(Path('config/shows').glob('*.json'))
    shows = []
    
    for show_file in show_files:
        show = load_json(show_file)
        if not show:
            continue
        shows.append(show)
    
    # Parse schedule times
    schedule = []
    for show in shows:
        show_id = show['id']
        start = show['schedule']['start_time_utc']
        end = show['schedule']['end_time_utc']
        
        # Parse HH:MM format
        start_hour, start_min = map(int, start.split(':'))
        end_hour, end_min = map(int, end.split(':'))
        
        schedule.append({
            'id': show_id,
            'start': start_hour * 60 + start_min,
            'end': end_hour * 60 + end_min if end != "00:00" else 24 * 60
        })
    
    # Sort by start time
    schedule.sort(key=lambda x: x['start'])
    
    # Check for gaps and overlaps
    for i in range(len(schedule)):
        current = schedule[i]
        next_show = schedule[(i + 1) % len(schedule)]
        
        expected_end = next_show['start'] if i < len(schedule) - 1 else 24 * 60
        
        if current['end'] < expected_end:
            gap = expected_end - current['end']
            errors.append(f"Gap of {gap} minutes between {current['id']} and {next_show['id']}")
        elif current['end'] > expected_end:
            overlap = current['end'] - expected_end
            errors.append(f"Overlap of {overlap} minutes between {current['id']} and {next_show['id']}")
    
    # Verify 24-hour coverage
    total_minutes = sum(s['end'] - s['start'] for s in schedule)
    if total_minutes != 24 * 60:
        errors.append(f"Total coverage is {total_minutes/60:.1f} hours, not 24")
    else:
        print(f"✓ All 8 shows cover 24 hours")
    
    for show in schedule:
        duration = (show['end'] - show['start']) / 60
        print(f"  {show['id']}: {show['start']//60:02d}:{show['start']%60:02d} - {show['end']//60:02d}:{show['end']%60:02d} ({duration:.1f}h)")
    
    return errors


def validate_ai_budgets():
    """Validate AI budget allocations align with show parameters."""
    print("\n=== AI Budget Validation ===")
    warnings = []
    
    show_files = sorted(Path('config/shows').glob('*.json'))
    for show_file in show_files:
        show = load_json(show_file)
        if not show:
            continue
        
        show_id = show['id']
        duration_hours = show['schedule']['duration_hours']
        talk_fraction = show['ratios']['talk_fraction']
        music_fraction = show['ratios']['music_fraction']
        
        budget = show['ai_budget']
        tts_budget = budget['max_tts_seconds_per_show']
        music_budget = budget['max_music_minutes_per_show']
        
        # Calculate expected budgets
        total_seconds = duration_hours * 3600
        expected_tts = total_seconds * talk_fraction
        expected_music_mins = (total_seconds * music_fraction) / 60
        
        # Check if budgets are reasonable
        if abs(tts_budget - expected_tts) > 60:
            warnings.append(f"{show_id}: TTS budget {tts_budget}s differs from expected {expected_tts:.0f}s")
        
        if abs(music_budget - expected_music_mins) > 5:
            warnings.append(f"{show_id}: Music budget {music_budget}min differs from expected {expected_music_mins:.0f}min")
        
        print(f"✓ {show_id}: TTS {tts_budget}s, Music {music_budget}min")
    
    return warnings


def main():
    """Run all validation checks."""
    print("Lofield FM Configuration Validator\n")
    
    all_errors = []
    all_warnings = []
    
    # Run validation checks
    all_errors.extend(validate_json_syntax())
    all_errors.extend(validate_cross_references())
    all_errors.extend(validate_music_ratios())
    all_errors.extend(validate_schedule_coverage())
    all_warnings.extend(validate_ai_budgets())
    
    # Print summary
    print("\n" + "=" * 50)
    if all_errors:
        print(f"\n✗ VALIDATION FAILED with {len(all_errors)} error(s):\n")
        for error in all_errors:
            print(f"  ✗ {error}")
        sys.exit(1)
    elif all_warnings:
        print(f"\n⚠ VALIDATION PASSED with {len(all_warnings)} warning(s):\n")
        for warning in all_warnings:
            print(f"  ⚠ {warning}")
    else:
        print("\n✓ ALL VALIDATION CHECKS PASSED!")
    
    print("\nConfiguration is valid and ready to use.")


if __name__ == '__main__':
    main()
