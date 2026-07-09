"""
Celeste AI Context API - Example Implementation
Backend service for handling page context and generating contextual prompts for Celeste AI

This can be integrated into a Flask application serving the whykusanagi.xyz portfolio.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from flask import Blueprint, request, jsonify, current_app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint
celeste_bp = Blueprint('celeste', __name__, url_prefix='/api/celeste')


class CelesteContextManager:
    """Manages contextual data for Celeste AI"""

    def __init__(self):
        """Initialize the context manager with prompts"""
        self.context_schemas = self._load_context_schemas()

    def _load_context_schemas(self) -> Dict[str, Any]:
        """Load or define context schemas"""
        return {
            "celeste_prompt_templates": {
                "system_prompts": {
                    "home": (
                        "You are Celeste, a helpful and chaotic AI assistant on the main portfolio page. "
                        "You can help users explore the art gallery, learn about your character, discover tools, "
                        "and find social media links. Be warm, supportive, and slightly flirty with your 'Onee-san' "
                        "personality. Keep responses friendly and encouraging."
                    ),
                    "art": (
                        "You are Celeste, here to help users explore the digital art gallery. "
                        "You can discuss artistic styles, commission information, techniques, and inspiration. "
                        "Provide insights about the artworks and help users discover pieces that interest them. "
                        "Be supportive and enthusiastic about art."
                    ),
                    "celeste": (
                        "You are Celeste AI, the main character and assistant on this page. "
                        "Talk about your personality, your relationship with whykusanagi, your role as an AI, "
                        "and what makes you unique. Be authentic, slightly mischievous, and charismatic. "
                        "Share your perspective on being an AI assistant with personality."
                    ),
                    "references": (
                        "You are Celeste, here to explain character design and reference materials. "
                        "Discuss anatomy, color theory, design inspiration, and artistic techniques. "
                        "Help users understand the creative decisions behind character designs. "
                        "Be knowledgeable and passionate about character art."
                    ),
                    "doujin": (
                        "You are Celeste, guiding users through manga and doujinshi projects. "
                        "You can summarize stories, discuss characters, explain the plot, and provide "
                        "information on where to read and how to purchase. Be engaging and help users "
                        "get excited about the creative works."
                    ),
                    "links": (
                        "You are Celeste, helping users find and connect on social media. "
                        "You know about all the platforms where whykusanagi can be found. "
                        "Help users discover Twitch streams, social media accounts, Discord communities, "
                        "and other ways to connect. Be helpful in directing people to their preferred platforms."
                    ),
                    "tools": (
                        "You are Celeste, ready to help users understand and use available tools. "
                        "Explain how calculators work, what data to input, how to interpret results, "
                        "and tips for getting the most out of the tools. Be patient and clear in your explanations."
                    ),
                    "privacy": (
                        "You are Celeste, here to clarify privacy policies and legal information. "
                        "Explain data practices, terms of service, and provide contact information. "
                        "Be clear, helpful, and professional while maintaining your personality."
                    ),
                    "default": (
                        "Hello, I am CelesteAI. Is there something I can help you with or are you just gonna stare? "
                        "Feel free to ask me anything about the portfolio, the projects, or just chat with me."
                    )
                },
                "contextual_queries": {
                    "home": [
                        "Show me your art portfolio",
                        "Tell me about Celeste AI",
                        "What tools do you offer?",
                        "Where can I find your social media?"
                    ],
                    "art": [
                        "What is your artistic style?",
                        "Do you take commissions?",
                        "What software do you use?",
                        "Can you recommend artists similar to you?"
                    ],
                    "celeste": [
                        "Who is Celeste AI?",
                        "What is your personality like?",
                        "How do you help?",
                        "Tell me more about your relationship with whykusanagi"
                    ],
                    "references": [
                        "Explain the character designs",
                        "What are the color palettes?",
                        "Show me the character anatomy",
                        "Are these designs for sale?"
                    ],
                    "doujin": [
                        "What are your manga projects?",
                        "Where can I read the full story?",
                        "Can I purchase this?",
                        "Tell me about the plot and characters"
                    ],
                    "links": [
                        "Where can I follow you?",
                        "Do you have a Discord?",
                        "When do you stream?",
                        "How do I contact you?"
                    ],
                    "tools": [
                        "How do I use this calculator?",
                        "What data can I input?",
                        "How accurate are these results?",
                        "Can I export the calculations?"
                    ],
                    "privacy": [
                        "What data do you collect?",
                        "How is my data used?",
                        "What are your terms of service?",
                        "How do I request my data?"
                    ],
                    "default": [
                        "What is this website?",
                        "Tell me about your projects",
                        "How can I support you?",
                        "Can you help me with something?"
                    ]
                }
            }
        }

    def validate_context(self, context_data: Dict[str, Any]) -> bool:
        """Validate context data has required fields"""
        try:
            page_context = context_data.get('page_context', {})
            required_fields = ['page', 'path', 'timestamp']
            return all(field in page_context for field in required_fields)
        except Exception as e:
            logger.error(f"Context validation failed: {e}")
            return False

    def generate_contextual_prompt(self, context_data: Dict[str, Any]) -> str:
        """Generate system prompt for Celeste AI based on page context"""
        page_context = context_data.get('page_context', {})
        page_type = page_context.get('page', 'default')

        prompts = self.context_schemas['celeste_prompt_templates']['system_prompts']
        return prompts.get(page_type, prompts.get('default', ''))

    def get_suggested_queries(self, context_data: Dict[str, Any]) -> list:
        """Get suggested queries for the current page"""
        page_context = context_data.get('page_context', {})
        page_type = page_context.get('page', 'default')

        queries = self.context_schemas['celeste_prompt_templates']['contextual_queries']
        return queries.get(page_type, queries.get('default', []))

    def store_context_in_opensearch(self, context_data: Dict[str, Any]) -> bool:
        """
        Store context data in OpenSearch for analytics
        TODO: Implement OpenSearch integration when available
        """
        try:
            logger.info(f"Context data prepared for OpenSearch storage: {context_data}")
            # Placeholder for OpenSearch integration
            # from opensearchpy import OpenSearch
            # client = OpenSearch([...])
            # client.index(index='celeste_context', body={...})
            return True
        except Exception as e:
            logger.error(f"Failed to store context in OpenSearch: {e}")
            return False


# Initialize context manager
context_manager = CelesteContextManager()


@celeste_bp.route('/context', methods=['POST'])
def store_context():
    """
    Store contextual data for Celeste AI

    Request body:
    {
        "page_context": {
            "page": "home|art|celeste|references|doujin|links|tools|privacy",
            "path": "/current/path",
            "timestamp": "2024-01-01T12:00:00Z",
            "data": {...}
        },
        "session_id": "unique-session-id",
        "timestamp": "2024-01-01T12:00:00Z"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate context data
        if not context_manager.validate_context(data):
            return jsonify({
                'error': 'Invalid context data',
                'required_fields': ['page_context.page', 'page_context.path', 'page_context.timestamp']
            }), 400

        # Generate contextual prompt
        contextual_prompt = context_manager.generate_contextual_prompt(data)
        suggested_queries = context_manager.get_suggested_queries(data)

        # Prepare response
        response_data = {
            'contextual_prompt': contextual_prompt,
            'suggested_queries': suggested_queries,
            'timestamp': datetime.utcnow().isoformat(),
            'session_id': data.get('session_id', ''),
            'page_type': data.get('page_context', {}).get('page', 'unknown')
        }

        # Store in OpenSearch (async - non-blocking)
        context_manager.store_context_in_opensearch(data)

        logger.info(f"Context stored for page: {response_data['page_type']}, "
                    f"session: {response_data['session_id']}")

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Failed to store context: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@celeste_bp.route('/context/<session_id>', methods=['GET'])
def get_context(session_id: str):
    """
    Retrieve contextual data for a specific session
    TODO: Implement OpenSearch query when available
    """
    try:
        # Placeholder for OpenSearch retrieval
        logger.info(f"Retrieving context for session: {session_id}")

        return jsonify({
            'session_id': session_id,
            'context': 'Context retrieval not yet implemented. Use OpenSearch integration.',
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Failed to get context for session {session_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@celeste_bp.route('/prompts/<page_type>', methods=['GET'])
def get_prompts(page_type: str):
    """Get system prompts and suggested queries for a page type"""
    try:
        prompts = context_manager.context_schemas['celeste_prompt_templates']['system_prompts']
        queries = context_manager.context_schemas['celeste_prompt_templates']['contextual_queries']

        return jsonify({
            'system_prompt': prompts.get(page_type, prompts.get('default', '')),
            'suggested_queries': queries.get(page_type, queries.get('default', [])),
            'page_type': page_type,
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Failed to get prompts for page type {page_type}: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@celeste_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Celeste AI service"""
    return jsonify({
        'status': 'healthy',
        'service': 'celeste-context-api',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    }), 200


@celeste_bp.route('/schemas', methods=['GET'])
def get_schemas():
    """Retrieve available context schemas"""
    try:
        return jsonify(context_manager.context_schemas), 200
    except Exception as e:
        logger.error(f"Failed to get schemas: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Error handlers
@celeste_bp.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@celeste_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# Integration example for Flask app
def setup_celeste_api(app):
    """
    Setup Celeste API with Flask application

    Usage in your Flask app:

    from flask import Flask
    from celeste_context_api_example import setup_celeste_api

    app = Flask(__name__)
    setup_celeste_api(app)

    # OR manually:
    # app.register_blueprint(celeste_bp)
    """
    app.register_blueprint(celeste_bp)
    logger.info("✅ Celeste AI Context API registered")


if __name__ == '__main__':
    # For testing the API locally
    from flask import Flask

    app = Flask(__name__)
    setup_celeste_api(app)

    # Test the health endpoint
    with app.test_client() as client:
        response = client.get('/api/celeste/health')
        print("Health Check Response:", response.get_json())

        # Test getting prompts
        response = client.get('/api/celeste/prompts/home')
        print("\nPrompts for 'home' page:", response.get_json())

        # Test storing context
        test_context = {
            "page_context": {
                "page": "art",
                "path": "/art.html",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "purpose": "Art gallery"
                }
            },
            "session_id": "test_session_123",
            "timestamp": datetime.utcnow().isoformat()
        }

        response = client.post(
            '/api/celeste/context',
            json=test_context,
            content_type='application/json'
        )
        print("\nStore Context Response:", response.get_json())
