// webflow_plans_supabase.js
// MCT eSIM - Webflow checkout script
// Fetches plans from Supabase, supports promo codes with date validation

(async function () {
  // =====================================================
  // CONFIG
  // =====================================================
  const SUPABASE_URL = "https://cdgktrkjvmnfxjxdlkth.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZ2t0cmtqdm1uZnhqeGRsa3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODI5NzQsImV4cCI6MjA5NTQ1ODk3NH0.UNMLGehY61XujIJg3WyqCuQ9AAnn2RnCEaCLwYizN_Y";
  const RAILWAY_URL = "https://web-production-88d45.up.railway.app";

  // =====================================================
  // HELPERS - Supabase REST API
  // =====================================================
  async function supabaseFetch(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    return res.json();
  }

  // =====================================================
  // GET COUNTRY FROM URL PATH
  // =====================================================
  const path = window.location.pathname.replace(/\/$/, "");
  const segments = path.split("/");
  const currentCountry = segments[segments.length - 1].toLowerCase().trim();

  // =====================================================
  // DOM ELEMENTS
  // =====================================================
  const dataSelect = document.getElementById("data-select");
  const daysSelect = document.getElementById("days-select");
  const priceText = document.getElementById("price-display");
  const buyBtn = document.getElementById("buy-button");
  const btnMinus = document.getElementById("btn-minus");
  const btnPlus = document.getElementById("btn-plus");
  const qtyInput = document.getElementById("qty-input");
  const promoInput = document.getElementById("promo-input");
  const promoBtn = document.getElementById("promo-btn");
  const promoMsg = document.getElementById("promo-msg");

  if (!dataSelect || !daysSelect || !priceText || !buyBtn) return;

  // =====================================================
  // LOAD PLANS FROM SUPABASE
  // =====================================================
  let plans = [];
  try {
    plans = await supabaseFetch(
      "plans",
      `handle=eq.${encodeURIComponent(currentCountry)}&select=key,sku,travel_data,travel_period,price_sgd&order=price_sgd.asc`
    );
  } catch (err) {
    console.error("Failed to load plans:", err);
    return;
  }

  if (!plans || plans.length === 0) {
    console.error("No plans found for:", currentCountry);
    return;
  }

  // =====================================================
  // BUILD DATA STRUCTURE: { travel_data -> { travel_period -> plan } }
  // =====================================================
  const countryData = {};
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  plans.forEach((p) => {
    const dataLabel = p.travel_data || "";
    const dayLabel = String(p.travel_period || "");
    const price = parseFloat(p.price_sgd);

    if (!countryData[dataLabel]) countryData[dataLabel] = {};
    countryData[dataLabel][dayLabel] = {
      sku: p.key,
      price: `$${price.toFixed(2)}`,
    };

    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
  });

  const rangePriceText =
    minPrice === maxPrice
      ? `$${minPrice.toFixed(2)}`
      : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

  // =====================================================
  // PROMO CODE STATE
  // =====================================================
  let appliedDiscount = 0;
  let appliedCode = "";

  // =====================================================
  // INIT DATA DROPDOWN
  // =====================================================
  dataSelect.innerHTML = '<option value="" disabled selected>Select Data...</option>';
  Object.keys(countryData).forEach((dataVal) => {
    dataSelect.add(new Option(dataVal, dataVal));
  });

  // =====================================================
  // CURRENT CART
  // =====================================================
  let currentCartItem = {};

  // =====================================================
  // UPDATE DAYS DROPDOWN
  // =====================================================
  function updateDaysOptions() {
    daysSelect.innerHTML = '<option value="" disabled selected>Select Days...</option>';
    const selectedData = dataSelect.value;
    if (selectedData && countryData[selectedData]) {
      const sortedDays = Object.keys(countryData[selectedData]).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      sortedDays.forEach((dayVal) => {
        daysSelect.add(new Option(`${dayVal} day(s)`, dayVal));
      });
    }
    updateCheckout();
  }

  // =====================================================
  // UPDATE PRICE + CART
  // =====================================================
  function updateCheckout() {
    const selectedData = dataSelect.value;
    const selectedDays = daysSelect.value;

    if (
      !selectedData ||
      !selectedDays ||
      !countryData[selectedData] ||
      !countryData[selectedData][selectedDays]
    ) {
      priceText.innerText = rangePriceText;
      buyBtn.style.opacity = "0.5";
      buyBtn.style.pointerEvents = "none";
      buyBtn.innerText = "Select Options";
      if (btnMinus) btnMinus.classList.add("disabled");
      if (btnPlus) btnPlus.classList.add("disabled");
      return;
    }

    const activeVariant = countryData[selectedData][selectedDays];
    const unitPrice = parseFloat(activeVariant.price.replace(/[^\d.-]/g, ""));
    const quantity = parseInt(qtyInput.value) || 1;

    if (btnMinus) btnMinus.classList.toggle("disabled", quantity <= 1);
    if (btnPlus) btnPlus.classList.remove("disabled");

    const discountMultiplier = 1 - appliedDiscount / 100;
    const discountedUnit = unitPrice * discountMultiplier;
    const totalPrice = (discountedUnit * quantity).toFixed(2);

    if (appliedDiscount > 0) {
      const original = (unitPrice * quantity).toFixed(2);
      priceText.innerHTML = `<s style="opacity:0.5">$${original}</s> $${totalPrice} <span style="color:green;font-size:0.85em">(${appliedDiscount}% off)</span>`;
    } else {
      priceText.innerText = "$" + totalPrice;
    }

    currentCartItem = {
      sku: activeVariant.sku,
      product_name: `eSIM ${currentCountry.toUpperCase()} - ${selectedData} / ${selectedDays} day(s)`,
      unit_price: parseFloat(discountedUnit.toFixed(2)),
      quantity: quantity,
      total_price: parseFloat(totalPrice),
      promo_code: appliedDiscount > 0 ? appliedCode : "",
    };

    buyBtn.style.opacity = "1";
    buyBtn.innerText = "Buy Now";
    buyBtn.style.pointerEvents = "auto";
  }

  // =====================================================
  // PROMO CODE LOGIC (with start_date + end_date validation)
  // =====================================================
  if (promoBtn && promoInput) {
    promoBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      const code = promoInput.value.trim().toUpperCase();
      if (!code) return;

      promoBtn.innerText = "Checking...";
      promoBtn.style.pointerEvents = "none";

      try {
        const results = await supabaseFetch(
          "promo_codes",
          `code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,discount_percent,start_date,end_date`
        );

        if (results && results.length > 0) {
          const promo = results[0];
          const now = new Date();
          const start = promo.start_date ? new Date(promo.start_date) : null;
          const end = promo.end_date ? new Date(promo.end_date) : null;

          if (start && now < start) {
            // Not yet active
            appliedDiscount = 0;
            appliedCode = "";
            if (promoMsg) {
              promoMsg.style.color = "orange";
              promoMsg.innerText = "⏳ Promo code not yet active.";
            }
          } else if (end && now > end) {
            // Expired
            appliedDiscount = 0;
            appliedCode = "";
            if (promoMsg) {
              promoMsg.style.color = "red";
              promoMsg.innerText = "❌ Promo code has expired.";
            }
          } else {
            // Valid
            appliedDiscount = parseFloat(promo.discount_percent);
            appliedCode = code;
            if (promoMsg) {
              promoMsg.style.color = "green";
              promoMsg.innerText = `✅ Promo applied: ${appliedDiscount}% off!`;
            }
          }
        } else {
          appliedDiscount = 0;
          appliedCode = "";
          if (promoMsg) {
            promoMsg.style.color = "red";
            promoMsg.innerText = "❌ Invalid or expired promo code.";
          }
        }
        updateCheckout();
      } catch (err) {
        if (promoMsg) {
          promoMsg.style.color = "red";
          promoMsg.innerText = "Error checking promo code. Please try again.";
        }
      }

      promoBtn.innerText = "Apply";
      promoBtn.style.pointerEvents = "auto";
    });
  }

  // =====================================================
  // QUANTITY BUTTONS
  // =====================================================
  if (btnMinus && btnPlus && qtyInput) {
    btnMinus.addEventListener("click", function (e) {
      e.preventDefault();
      if (!dataSelect.value || !daysSelect.value) return;
      const q = parseInt(qtyInput.value) || 1;
      if (q > 1) { qtyInput.value = q - 1; updateCheckout(); }
    });
    btnPlus.addEventListener("click", function (e) {
      e.preventDefault();
      if (!dataSelect.value || !daysSelect.value) return;
      qtyInput.value = (parseInt(qtyInput.value) || 1) + 1;
      updateCheckout();
    });
    qtyInput.addEventListener("change", function () {
      const q = parseInt(qtyInput.value);
      if (isNaN(q) || q < 1) qtyInput.value = 1;
      updateCheckout();
    });
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================
  dataSelect.addEventListener("change", updateDaysOptions);
  daysSelect.addEventListener("change", updateCheckout);

  updateDaysOptions();

  // =====================================================
  // BUY NOW
  // =====================================================
  buyBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    if (!currentCartItem.sku) return;

    buyBtn.innerText = "Processing...";
    buyBtn.style.opacity = "0.6";
    buyBtn.style.pointerEvents = "none";

    try {
      const response = await fetch(`${RAILWAY_URL}/checkout/webflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentCartItem),
      });

      const data = await response.json();

      if (data && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert("Server error. Please try again.");
        buyBtn.innerText = "Buy Now";
        buyBtn.style.opacity = "1";
        buyBtn.style.pointerEvents = "auto";
      }
    } catch (err) {
      alert("Network error. Please check your connection.");
      buyBtn.innerText = "Buy Now";
      buyBtn.style.opacity = "1";
      buyBtn.style.pointerEvents = "auto";
    }
  });
})();
