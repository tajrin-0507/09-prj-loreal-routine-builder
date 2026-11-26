# Project 9: L'Oréal Routine Builder

Browse products by category, select items for a routine, and ask the beauty advisor follow-up questions. Product selections are saved in this browser.

## Run the project

Open the project through a local web server or Codespace so the page can load `products.json`. Choose a category, select products, and click **Generate Routine**. After the routine appears, use the chat box to ask related follow-up questions.

The frontend sends the selected product details and conversation history to the class Cloudflare Worker at `https://loreal-chatbot.tajrinabdullah.workers.dev/`. The Worker needs to be updated with [worker.js](./worker.js) to enable live web search and return citations. In Cloudflare, replace the Worker script with that file and configure `OPENAI_API_KEY` as a Worker secret. Never add the key to this repository or frontend code. Once deployed, answers can include clickable web sources.

Use the **Display direction** menu to switch between left-to-right English and right-to-left Arabic layout. The selected direction is saved in this browser. Use the product search field together with the category menu to filter by product name, brand, category, or description keywords.