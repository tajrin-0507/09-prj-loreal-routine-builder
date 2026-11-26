const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const directionSelect = document.getElementById("directionSelect");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateButton = document.getElementById("generateRoutine");
const clearSelectionsButton = document.getElementById("clearSelections");
const workerUrl = "https://loreal-chatbot.tajrinabdullah.workers.dev/";
const selectionStorageKey = "loreal-routine-selected-products";
const directionStorageKey = "loreal-routine-display-direction";
const systemMessage = {
  role: "system",
  content:
    "You are a friendly L'Oréal beauty advisor. Give practical, safe, personalized advice about skincare, haircare, makeup, fragrance, and related beauty topics. When building a routine, use only the products provided by the user and explain the order and when to use them. Do not invent product ingredients or make medical diagnoses. Keep follow-up answers relevant to the routine and beauty topics; politely redirect unrelated questions to beauty topics.",
};

// Keep the full catalog, saved selection, and AI conversation available to the page.
let allProducts = [];
let selectedProductIds = new Set();
let conversation = [];
let isRequestInProgress = false;

async function loadProducts() {
  const response = await fetch("products.json");
  if (!response.ok) {
    throw new Error(`Could not load products (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.products)) {
    throw new Error("The product file does not contain a valid products list.");
  }
  return data.products;
}

function displayProducts(products) {
  productsContainer.replaceChildren();

  if (products.length === 0) {
    showPlaceholder("No products match your filters.");
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    const selectButton = document.createElement("button");
    const image = document.createElement("img");
    const info = document.createElement("span");
    const name = document.createElement("strong");
    const brand = document.createElement("span");
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const description = document.createElement("p");
    const isSelected = selectedProductIds.has(product.id);

    card.className = `product-card${isSelected ? " is-selected" : ""}`;
    card.dataset.productId = String(product.id);
    selectButton.type = "button";
    selectButton.className = "product-select";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.setAttribute(
      "aria-label",
      `${isSelected ? "Remove" : "Add"} ${product.name} ${isSelected ? "from" : "to"} selected products`
    );
    image.src = product.image;
    image.alt = "";
    image.loading = "lazy";
    name.textContent = product.name;
    brand.textContent = product.brand;
    info.className = "product-info";
    info.append(name, brand);
    selectButton.append(image, info);
    selectButton.addEventListener("click", () => toggleProduct(product.id));

    details.className = "product-details";
    summary.textContent = "Product details";
    description.textContent = product.description;
    details.append(summary, description);
    card.append(selectButton, details);
    productsContainer.append(card);
  });
}

function showPlaceholder(message) {
  const placeholder = document.createElement("p");
  placeholder.className = "placeholder-message";
  placeholder.textContent = message;
  productsContainer.replaceChildren(placeholder);
}

function renderSelectedProducts() {
  selectedProductsList.replaceChildren();
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id)
  );

  if (selectedProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-selection";
    emptyMessage.textContent = "Your selection is empty. Choose products above to get started.";
    selectedProductsList.append(emptyMessage);
  } else {
    selectedProducts.forEach((product) => {
      const item = document.createElement("div");
      const name = document.createElement("span");
      const removeButton = document.createElement("button");

      item.className = "selected-product";
      name.textContent = `${product.brand} · ${product.name}`;
      removeButton.type = "button";
      removeButton.className = "remove-product";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${product.name}`);
      removeButton.addEventListener("click", () => toggleProduct(product.id));
      item.append(name, removeButton);
      selectedProductsList.append(item);
    });
  }

  generateButton.disabled = selectedProducts.length === 0 || isRequestInProgress;

  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    const product = allProducts.find(
      (item) => String(item.id) === card.dataset.productId
    );
    if (!product) {
      return;
    }

    const isSelected = selectedProductIds.has(product.id);
    const selectButton = card.querySelector(".product-select");
    card.classList.toggle("is-selected", isSelected);
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.setAttribute(
      "aria-label",
      `${isSelected ? "Remove" : "Add"} ${product.name} ${isSelected ? "from" : "to"} selected products`
    );
  });
}

function saveSelectedProducts() {
  try {
    localStorage.setItem(selectionStorageKey, JSON.stringify([...selectedProductIds]));
  } catch (error) {
    addChatMessage(
      `Your selection changed, but could not be saved in this browser. ${error.message}`,
      "error-message"
    );
  }
}

function toggleProduct(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProducts();
  renderSelectedProducts();
}

function addChatMessage(content, className, citations = []) {
  const message = document.createElement("div");
  message.className = `chat-message ${className}`;
  message.textContent = content;

  const validCitations = citations.filter((citation) => {
    try {
      const citationUrl = new URL(citation.url);
      return (
        (citationUrl.protocol === "https:" || citationUrl.protocol === "http:") &&
        typeof citation.title === "string"
      );
    } catch (error) {
      return false;
    }
  });

  if (validCitations.length > 0) {
    const sources = document.createElement("div");
    const heading = document.createElement("strong");
    const links = document.createElement("ul");
    sources.className = "citation-sources";
    heading.textContent = "Sources";
    validCitations.forEach((citation) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title;
      item.append(link);
      links.append(item);
    });
    sources.append(heading, links);
    message.append(sources);
  }

  chatWindow.append(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

function setRequestState(isLoading) {
  isRequestInProgress = isLoading;
  chatInput.disabled = isLoading || conversation.length === 0;
  sendButton.disabled = isLoading || conversation.length === 0;
  generateButton.disabled =
    isLoading ||
    !allProducts.some((product) => selectedProductIds.has(product.id));
}

async function requestAdvisorReply(messages) {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data && data.error ? data.error : `Worker request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const reply = data && data.choices && data.choices[0] &&
    data.choices[0].message && data.choices[0].message.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("The advisor returned an empty or invalid response.");
  }
  return {
    text: reply,
    citations: Array.isArray(data.citations) ? data.citations : [],
  };
}

function filterProducts() {
  const searchTerm = productSearch.value.trim().toLocaleLowerCase();
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      !categoryFilter.value || product.category === categoryFilter.value;
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return matchesCategory && (!searchTerm || searchableText.includes(searchTerm));
  });

  displayProducts(filteredProducts);
}

function setDisplayDirection(direction) {
  const isRightToLeft = direction === "rtl";
  document.documentElement.dir = isRightToLeft ? "rtl" : "ltr";
  document.documentElement.lang = isRightToLeft ? "ar" : "en";
  directionSelect.value = isRightToLeft ? "rtl" : "ltr";
}

categoryFilter.addEventListener("change", filterProducts);
productSearch.addEventListener("input", filterProducts);

directionSelect.addEventListener("change", () => {
  const direction = directionSelect.value === "rtl" ? "rtl" : "ltr";
  setDisplayDirection(direction);
  try {
    localStorage.setItem(directionStorageKey, direction);
  } catch (error) {
    addChatMessage(
      `The display direction changed, but could not be saved in this browser. ${error.message}`,
      "error-message"
    );
  }
});

clearSelectionsButton.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelectedProducts();
  renderSelectedProducts();
});

generateButton.addEventListener("click", async () => {
  const selectedProducts = allProducts
    .filter((product) => selectedProductIds.has(product.id))
    .map(({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    }));

  if (selectedProducts.length === 0 || isRequestInProgress) {
    return;
  }

  const userMessage = {
    role: "user",
    content: `Create a personalized routine using these selected products. Product data:\n${JSON.stringify(selectedProducts, null, 2)}`,
  };
  const newConversation = [systemMessage, userMessage];
  const loadingMessage = addChatMessage("Building your routine…", "status-message");
  setRequestState(true);

  try {
    const response = await requestAdvisorReply(newConversation);
    conversation = [...newConversation, { role: "assistant", content: response.text }];
    chatWindow.replaceChildren();
    addChatMessage("Please create a routine with my selected products.", "user-message");
    addChatMessage(response.text, "assistant-message", response.citations);
  } catch (error) {
    loadingMessage.remove();
    addChatMessage(
      `I couldn't generate your routine. ${error.message}`,
      "error-message"
    );
  } finally {
    setRequestState(false);
    renderSelectedProducts();
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question || conversation.length === 0 || isRequestInProgress) {
    return;
  }

  const userMessage = { role: "user", content: question };
  conversation.push(userMessage);
  addChatMessage(question, "user-message");
  chatInput.value = "";
  setRequestState(true);

  try {
    const response = await requestAdvisorReply(conversation);
    conversation.push({ role: "assistant", content: response.text });
    addChatMessage(response.text, "assistant-message", response.citations);
  } catch (error) {
    conversation.pop();
    addChatMessage(
      `I couldn't get a reply. ${error.message}`,
      "error-message"
    );
  } finally {
    setRequestState(false);
  }
});

async function initialize() {
  setDisplayDirection("ltr");
  try {
    const savedDirection = localStorage.getItem(directionStorageKey);
    if (savedDirection === "rtl" || savedDirection === "ltr") {
      setDisplayDirection(savedDirection);
    }
  } catch (error) {
    addChatMessage(
      `The saved display direction could not be restored. ${error.message}`,
      "error-message"
    );
  }

  showPlaceholder("Browse all products or filter by category and keyword.");
  addChatMessage(
    "Choose products from the catalog, then generate a personalized routine. You can ask follow-up questions afterward.",
    "assistant-message"
  );

  try {
    allProducts = await loadProducts();
  } catch (error) {
    showPlaceholder(`Unable to load the product catalog: ${error.message}`);
    addChatMessage(
      `The product catalog could not be loaded. ${error.message}`,
      "error-message"
    );
    return;
  }

  let savedIds = [];
  try {
    const storedIds = localStorage.getItem(selectionStorageKey);
    if (storedIds) {
      savedIds = JSON.parse(storedIds);
    }
    if (!Array.isArray(savedIds)) {
      throw new Error("Saved product selections are not in the expected format.");
    }
  } catch (error) {
    savedIds = [];
    addChatMessage(
      `Saved selections could not be restored. ${error.message}`,
      "error-message"
    );
  }

  const availableIds = new Set(allProducts.map((product) => product.id));
  selectedProductIds = new Set(
    savedIds.filter((productId) => availableIds.has(productId))
  );
  renderSelectedProducts();
  filterProducts();
}

initialize();
