from flask import Flask, request, jsonify, send_file, send_from_directory, url_for
from PIL import Image
import json
import os
from io import BytesIO

app = Flask(__name__, static_folder='public', static_url_path='/')

# Use absolute paths for file access
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'traits'))


special_assets = {
    'bape_coach': os.path.join(base_dir, 'memes', 'bape_coach.png'),
    'bape_hoodie_red': os.path.join(base_dir, 'memes', 'bape_hoodie_red.png'),
    'bape_hoodie_green': 'memes/bape_hoodie_green.png',
    'adidas_hoodie': 'memes/adidas_hoodie.png' ,
    'adidas_yellow': 'memes/adidas_yellow.png' ,
    'sweater': 'memes/sweater.png' 
}

main_assets = {
    'cheers': 'memes/cheers.png',
    'shoe': 'memes/bape_shoe.png',
    'peace': 'memes/peace.png'
    # Add more asset types here as needed
}

additional_assets = {
    'snow': 'memes/snow.png',
    'verified': 'memes/mask2.png'
    # Add more assets as needed
}

# RGB values for each color name
color_map = {
    "Aquamarine": (107, 227, 186),
    "Army Green": (112, 113, 61),
    "Blue": (176, 227, 242),
    "Gray": (204, 205, 206),
    "New Punk Blue": (69, 102, 122),
    "Orange": (226, 153, 70),
    "Purple": (108, 94, 111),
    "Yellow": (224, 223, 171)
}

def get_image_file(trait_type, value):
    if value:
        return os.path.join(base_dir, trait_type, f"{value}.png")
    else:
        return os.path.join(base_dir, "_blank.png")
    
def add_asset(image, asset_type, asset_dict):
    asset_path = os.path.join(base_dir, globals()[asset_dict].get(asset_type, '_blank.png'))
    print(f"Adding asset: {asset_path}")
    try:
        with Image.open(asset_path).convert("RGBA") as asset_image:
            image.alpha_composite(asset_image, (0, 0))
    except FileNotFoundError:
        print(f"File not found: {asset_path}")
    return image

    
def is_minted(token_id):
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'afa_db.json')
        with open(db_path, 'r') as file:
            minted_apes = json.load(file)
        return token_id in [ape['TOKENID'] for ape in minted_apes]
    except Exception as e:
        app.logger.error(f"Error in is_minted: {e}")
        return False@app.route('/api/get-asset', methods=['GET'])

def compose_ape(ape_id, data):
    ape = next((item for item in data["apes"] if str(item["id"]) == ape_id), None)
    if not ape:
        print(f"Ape with ID {ape_id} not found.")
        return None

    attributes = ape["metadata"]["attributes"]
    final_image = Image.new("RGBA", (2000, 2000), (255, 255, 255, 0))
    layers = {}

    # Add Normal Layers
    for attribute in attributes:
        trait_type = attribute["trait_type"]
        value = attribute["value"]
        image_path = get_image_file(trait_type, value)
        print(f"Loading {trait_type}: {image_path}")
        try:
            with Image.open(image_path) as img:
                layers[trait_type] = img.copy()
        except FileNotFoundError:
            print(f"File not found: {image_path}")

    # Composite the layers onto the final image
    for layer_type in ['Background', 'Fur', 'Eyes', 'Clothes', 'Earring', 'Hat', 'Mouth']:
        if layer_type in layers:
            final_image.alpha_composite(layers[layer_type], (0, 0))

    return final_image


@app.route('/api/get-asset', methods=['GET'])
def get_asset():
    token_id = request.args.get('tokenId')
    second_asset_type = request.args.get('secondAssetType', '')
    third_asset_type = request.args.get('thirdAssetType', '')

    try:
        if is_minted(token_id):
            db_path = os.path.join(os.path.dirname(__file__), 'db.json')
            with open(db_path, 'r') as file:
                data = json.load(file)
            
            # Create base ape image
            image = compose_ape(token_id, data)
            if not image:
                raise ValueError("Ape not found")

            # Add second and third assets if specified
            if second_asset_type:
                image = add_asset(image, second_asset_type, 'special_assets')
            if third_asset_type:
                image = add_asset(image, third_asset_type, 'additional_assets')

            img_io = BytesIO()
            image.save(img_io, 'PNG')
            img_io.seek(0)
            return send_file(img_io, mimetype='image/png')
        else:
            default_image_url = url_for('static', filename='/face.png')
            return jsonify({'image_url': default_image_url, 'message': 'This ape has not changed their perspective yet'})
    
    except Exception as e:
        print(f"Error processing Token ID {token_id}: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500


@app.route('/api/get-background-color', methods=['GET'])
def get_background_color():
    token_id = request.args.get('tokenId')
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'db.json')
        with open(db_path, 'r') as file:
            data = json.load(file)
            ape = next((item for item in data["apes"] if str(item["id"]) == token_id), None)
            if ape:
                background_color = next((attr['value'] for attr in ape["metadata"]["attributes"] if attr['trait_type'] == 'Background'), 'Default')
                rgb = color_map.get(background_color, (0, 0, 0))
                print(f"Background color RGB for token ID {token_id}: {rgb}")
                return jsonify({'background_color': rgb})
            else:
                raise ValueError("Ape not found")
    except Exception as e:
        print(f"Error processing Token ID {token_id}: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/api/token-ids', methods=['GET'])
def get_token_ids():
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'afa_db.json')
        with open(db_path, 'r') as file:
            minted_apes = json.load(file)
        return jsonify([ape['TOKENID'] for ape in minted_apes])
    except Exception as e:
        app.logger.error(f"Error in get_token_ids: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # Serve static files from the React app's public folder
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # Serve index.html for all other routes to enable SPA routing
        return send_from_directory(app.static_folder, '/index.html')

if __name__ == '__main__':
    app.run(debug=True)

