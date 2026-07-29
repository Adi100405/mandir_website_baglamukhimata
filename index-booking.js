const BACKEND_URL =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:5000"
      : "https://mandir-website-baglamukhimata.onrender.com";

  async function payNow(description = "Booking", meta = null) {
    try {
      if (!(meta && meta.purpose === "booking")) {
        alert("This website accepts puja and ritual service bookings only.");
        return;
      }

      const payload = {
        purpose: "booking",
        name: meta.name || "",
        phone: meta.phone || "",
        preferredWhatsapp: meta.preferredWhatsapp || meta.phone || "",
        email: meta.email || "",
        service: meta.service || "",
        gotra: meta.gotra || "",
        date: meta.date || "",
        time: meta.time || "",
        location: meta.location || "",
        address: meta.address || "",
        participants: Number(meta.participants) || 1,
        note: meta.note || ""
      };

      const res = await fetch(`${BACKEND_URL}/create-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to submit booking.");
      }

      try {
        sessionStorage.setItem("latestBookingReceipt", JSON.stringify(data.booking));
      } catch (e) {}

      window.location.href = `booking-success.html?booking_id=${encodeURIComponent(data.booking.bookingId)}`;
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong while submitting the booking.");
      throw err;
    }
  }

  async function submitBookingRazorpay() {
    var name = document.getElementById('f-name').value.trim();
    var phone = document.getElementById('f-phone').value.trim();
    var service = document.getElementById('f-service').value;
    var gotra = document.getElementById('f-gotra').value.trim();
    var date = document.getElementById('f-date').value;
    var time = document.getElementById('f-time').value;
    var location = document.getElementById('f-loc').value;
    var address = document.getElementById('f-address').value.trim();
    var whatsapp = typeof ensurePreferredWhatsappNumber === 'function'
      ? ensurePreferredWhatsappNumber()
      : ((document.getElementById('f-whatsapp') && document.getElementById('f-whatsapp').value.trim()) || phone);
    var email = document.getElementById('f-email').value.trim();
    var note = document.getElementById('f-note').value.trim();
    var pricing = calculateBookingPrice();
    var gotraToSend = gotra;
    var timeToSend = time;
    var locationToSend = location;
    var finalNote = buildBookingNote(note, service);
    var payBtn = document.getElementById('booking-pay-btn');

    if (!name || !phone || !whatsapp || !service || !date || !timeToSend) {
      alert("Please fill all required fields, including preferred WhatsApp number and preferred time slot.");
      return;
    }

    if (typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(phone)) {
      alert("Please enter a valid mobile number.");
      return;
    }

    if (typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(whatsapp)) {
      alert("Please enter a valid preferred WhatsApp number.");
      return;
    }

    if (email && !isValidEmailAddress(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!validateSelectedTimeSlot()) {
      alert("Please select an available time slot.");
      return;
    }

    var allowedLocations = getAllowedLocationsForService(service);
    if (allowedLocations.indexOf(locationToSend) === -1) {
      alert("Please select a valid location for this ritual.");
      applyServiceLocationRules();
      return;
    }

    if ((locationToSend === 'At My Home' || locationToSend === 'Other Location') && !address) {
      alert("Please enter the full address for the पूजा location.");
      return;
    }

    if (!window.Razorpay) {
      alert("Payment system failed to load. Please refresh and try again.");
      return;
    }

    try {
      payBtn.disabled = true;
      payBtn.textContent = 'Opening payment...';

      const createBookingRes = await fetch(`${BACKEND_URL}/create-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentMode: "razorpay",
          purpose: "booking",
          name: name,
          phone: phone,
          preferredWhatsapp: whatsapp,
          email: email,
          service: service,
          gotra: gotraToSend,
          date: date,
          time: timeToSend,
          location: locationToSend,
          address: address,
          participants: 1,
          note: finalNote
        })
      });

      const createBookingData = await createBookingRes.json();
      if (!createBookingRes.ok || !createBookingData.success) {
        throw new Error(createBookingData.error || "Unable to submit booking.");
      }

      const booking = createBookingData.booking;
      const keyRes = await fetch(`${BACKEND_URL}/api/razorpay-key`);
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.key_id) {
        throw new Error(keyData.error || "Unable to initialize payment.");
      }

      const orderRes = await fetch(`${BACKEND_URL}/api/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currency: "INR",
          receipt: booking.bookingId,
          bookingId: booking.bookingId
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order_id) {
        throw new Error(orderData.error || "Unable to create payment order.");
      }

      const options = {
        key: keyData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Shri Shakti Mandir",
        description: "Booking payment",
        order_id: orderData.order_id,
        prefill: {
          name: name,
          email: email,
          contact: phone
        },
        notes: {
          bookingId: booking.bookingId,
          service: service
        },
        modal: {
          ondismiss: function () {
            payBtn.disabled = false;
            payBtn.textContent = 'Pay Online (Razorpay)';
            alert("Payment cancelled.");
          }
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${BACKEND_URL}/api/verify-payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: booking.bookingId
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            try {
              sessionStorage.setItem("latestBookingReceipt", JSON.stringify(booking));
            } catch (e) {}

            window.location.href = `booking-success.html?booking_id=${encodeURIComponent(booking.bookingId)}`;
          } catch (err) {
            console.error(err);
            alert(err.message || "Payment verification failed.");
            payBtn.disabled = false;
            payBtn.textContent = 'Pay Online (Razorpay)';
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        const message = resp?.error?.description || resp?.error?.reason || "Payment failed.";
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Online (Razorpay)';
        alert(message);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      alert(err.message || "Payment failed. Please try again.");
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Online (Razorpay)';
    }
  }
