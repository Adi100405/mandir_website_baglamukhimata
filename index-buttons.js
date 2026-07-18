window.onload = function () {
      document.querySelectorAll(".btn-book").forEach(button => {
    
        button.addEventListener("click", function () {
    
          const pandit = this.dataset.pandit;
    
          console.log("Clicked:", pandit); // DEBUG
    
          const select = document.getElementById("f-pandit");
    
          select.value = pandit;
    
          document.getElementById("booking").scrollIntoView({
            behavior: "smooth"
          });
    
        });
    
      });
    };
