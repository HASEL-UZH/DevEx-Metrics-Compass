## **How to Run the Dashboard** 

***

### **Locally** 

1.  **Open the Terminal**.
2.  Navigate to the directory containing the dashboard files using the `cd` command. For example:
    ```bash
    cd "path to directory with dashboard.html"
    ```
    The directory must contain the following files:
    * `dashboard.html`
    * `script.js`
    * `style.css`
    * `data.json`
    * `source_ids.json`
    * `favicon.png`
    * `uzh-logo.svg`
3.  Run a simple HTTP server by entering the following command:
    ```bash
    python -m http.server
    ```
    
4.  Open your web browser and go to `http://localhost:8000/dashboard.html`.

***

### **Web Server** 

1.  **Upload all the dashboard files** to the web server. All files must be in the same directory.
    The directory must contain these files:
    * `dashboard.html`
    * `script.js`
    * `style.css`
    * `data.json`
    * `source_ids.json`
    * `favicon.png`
    * `uzh-logo.svg`
2.  Navigate to `dashboard.html` on your web server to view the dashboard.