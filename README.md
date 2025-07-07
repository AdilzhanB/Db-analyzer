# Advanced SQL Database Analyzer

A powerful tool for analyzing SQLite databases with advanced visualizations, statistical analysis, and AI-powered insights.

## Features

- **Database Schema Analysis**: Visualize your database structure and relationships with ER diagrams
- **Statistical Analysis**: Get detailed mathematical and statistical insights into your data
- **Advanced Analytics**: Create custom visualizations with multiple chart types
- **Correlation Analysis**: Automatically detect relationships between different data points
- **Gemini AI Assistant**: Chat with an AI assistant to gain deeper insights about your database

## Technologies Used

- React with TypeScript
- Material UI for modern, responsive design
- Chart.js and Recharts for data visualization
- SQL.js for in-browser SQLite operations
- Google Generative AI (Gemini) for intelligent database analysis

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/db-analyzer.git
cd db-analyzer
```

2. Install dependencies
```
cd frontend
npm install
```

3. Get a Gemini API key
   - Visit [Google AI Studio](https://makersuite.google.com/)
   - Create an API key
   - Create a `.env` file at the root (copy from `.env.example`) 
   - Add your API key to the `.env` file as `VITE_GEMINI_API_KEY=your_key_here`
   - Alternatively, directly replace the placeholder in `src/components/GeminiChat.tsx` with your key

4. Start the development server
```
npm run dev
```

## Usage

1. Upload your SQLite database (.sqlite, .db, or .sql file)
2. Explore the database schema, including tables, columns, and relationships
3. View mathematical analysis with detailed statistics about your data
4. Create custom visualizations in the Advanced Analytics tab
5. Chat with the Gemini AI assistant to ask questions about your database

## Screenshots

![Schema Analysis](path/to/schema-screenshot.png)
![Statistical Analysis](path/to/stats-screenshot.png)
![Advanced Analytics](path/to/analytics-screenshot.png)
![Gemini AI Chat](path/to/chat-screenshot.png)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- SQLite for the amazing database engine
- Google for the Gemini AI API
- The open-source community for all the fantastic libraries that made this possible
