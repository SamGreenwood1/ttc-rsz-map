import json
import os

# --- 1. Define the Reduced Speed Zones (from your list) ---
# This dictionary maps the line number to a list of segments.
# Each segment is a tuple: (start_station, end_station, direction)
reduced_speed_zones_data = {
    "Line 1": [
        ("York Mills", "Sheppard-Yonge", "Northbound"),
        ("Lawrence", "Eglinton", "Southbound"),
        ("Eglinton", "Davisville", "Southbound"),
        ("Davisville", "St Clair", "Southbound"),
        ("St Clair", "Summerhill", "Southbound"),
        ("Bloor-Yonge", "Rosedale", "Northbound"),
        ("Museum", "St George", "Northbound"),
        ("Spadina", "St George", "Both ways"),  # 'Both ways' might require two features
        ("Dupont", "Spadina", "Southbound"),
        ("St Clair West", "Dupont", "Southbound"),
        ("Eglinton West", "St Clair West", "Northbound"),
        ("Glencairn", "Eglinton West", "Southbound"),
        ("Glencairn", "Lawrence West", "Both ways"), # 'Both ways' might require two features
        ("Yorkdale", "Lawrence West", "Southbound"),
        ("Wilson", "Yorkdale", "Southbound"),
    ],
    "Line 2": [
        ("Warden", "Victoria Park", "Westbound"),
        ("Coxwell", "Main Street", "Eastbound"),
        ("Donlands", "Greenwood", "Eastbound"),
        ("Broadview", "Castle Frank", "Westbound"),
        ("Spadina", "St George", "Eastbound"),
        ("Spadina", "Bathurst", "Westbound"),
        ("Dundas West", "Lansdowne", "Eastbound"),
        ("Keele", "Dundas West", "Eastbound"),
        ("Jane", "Old Mill", "Westbound"),
    ],
}

# --- 2. Helper function to read GeoJSON files ---
def load_geojson(filepath):
    """Loads a GeoJSON file from the given path."""
    if not os.path.exists(filepath):
        print(f"Error: File not found at {filepath}")
        return None
    with open(filepath, 'r') as f:
        return json.load(f)

# --- 3. Placeholder for segment extraction logic ---
# THIS IS THE MOST CRITICAL PART YOU MIGHT NEED TO REFINE
# Depending on how precise your line GeoJSONs are and if
# they contain explicit station points or just the line geometry.
# For accurate segment extraction, you might need to:
# a) Have a separate stations.geojson with precise coordinates.
# b) Use a library like 'shapely' to find nearest points on the line.
def find_segment_coordinates(line_geojson_data, start_station, end_station, line_name):
    """
    Extracts coordinates for a segment between two stations from a LineString.
    This is a SIMPLIFIED placeholder.
    In a real scenario, you'd likely:
    1. Look up start_station and end_station coordinates from a known stations list.
    2. Find the indices of the points on the line_geojson_data's LineString
       that are closest to these station coordinates.
    3. Slice the line_geojson_data's coordinates array between those indices.

    For this example, it will return dummy data.
    You MUST implement this to work with your actual line data.
    """
    print(f"DEBUG: Attempting to find segment for {line_name}: {start_station} to {end_station}")
    # Placeholder: In a real implementation, you'd iterate through
    # line_geojson_data["features"][0]["geometry"]["coordinates"]
    # to find the relevant slice.
    # For now, returning a generic line segment.
    # REPLACE THIS WITH YOUR ACTUAL LOGIC.
    return [
        [-79.0, 43.0],  # Dummy start
        [-79.1, 43.1],  # Dummy middle
        [-79.2, 43.2]   # Dummy end
    ]

# --- 4. Main script to generate RSZ GeoJSON ---
def generate_rsz_geojson(lines_dir, output_filepath="speed_zones.geojson"):
    rsz_features = []

    for line_name, segments in reduced_speed_zones_data.items():
        line_num = line_name.replace("Line ", "").strip()
        line_filepath = os.path.join(lines_dir, f"line{line_num}.json")
        line_data = load_geojson(line_filepath)

        if not line_data:
            print(f"Skipping {line_name} as its GeoJSON could not be loaded.")
            continue

        # Assuming the line GeoJSON is a FeatureCollection with a single LineString Feature
        # Or you might need to adapt if it's a MultiLineString or different structure
        line_coordinates = None
        if line_data.get("type") == "FeatureCollection" and line_data["features"]:
            for feature in line_data["features"]:
                if feature["geometry"]["type"] == "LineString":
                    line_coordinates = feature["geometry"]["coordinates"]
                    break
            if not line_coordinates:
                print(f"Warning: No LineString geometry found in {line_filepath}")
                continue
        elif line_data.get("type") == "Feature" and line_data["geometry"]["type"] == "LineString":
            line_coordinates = line_data["geometry"]["coordinates"]
        else:
            print(f"Warning: Unexpected GeoJSON structure in {line_filepath}")
            continue

        for start_station, end_station, direction in segments:
            # Here, you would call your *actual* implementation of find_segment_coordinates
            # passing the loaded line_coordinates.
            # Example using the dummy:
            segment_coords = find_segment_coordinates(
                line_coordinates,  # Pass the actual line coordinates
                start_station,
                end_station,
                line_name
            )

            if segment_coords: # Ensure coordinates were found
                # Handle 'Both ways' by potentially creating two features or adding more detail
                feature_properties = {
                    "line": line_name,
                    "from_station": start_station,
                    "to_station": end_station,
                    "direction": direction,
                    "zone_type": "Reduced Speed Zone",
                    "name": f"{line_name} RSZ: {start_station} to {end_station} ({direction})"
                }

                rsz_features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": segment_coords
                    },
                    "properties": feature_properties
                })
            else:
                print(f"Could not find segment for {line_name}: {start_station} to {end_station}")


    final_geojson = {
        "type": "FeatureCollection",
        "features": rsz_features
    }

    with open(output_filepath, 'w') as f:
        json.dump(final_geojson, f, indent=2)
    print(f"\nSuccessfully generated {len(rsz_features)} RSZ features to {output_filepath}")

# --- Set your paths and run the script ---
if __name__ == "__main__":
    # IMPORTANT: Set this to the correct path to your 'lines' directory
    # Based on your file tree:
    lines_directory_path = "/mnt/c/Users/jamme/Documents/git/ttc-rsz-map/lines"
    output_geojson_path = "/mnt/c/Users/jamme/Documents/git/ttc-rsz-map/speed_zones.geojson"

    generate_rsz_geojson(lines_directory_path, output_geojson_path)