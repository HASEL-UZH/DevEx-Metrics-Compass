## **How to Add New Metrics** 

### **1. Open the Excel File**
1.  Navigate to the **"metrics"** sheet.
    * Add the new metric to the first empty row.
    * Continue the numbering in **column A**.
    * Fill in the metric's name (**column B**), synonyms (**column C**), description (**column F**), type (**column G**), AI specific category (**column P**), Outcome Goals (**column Q**), and Related Metrics (**column R**).
2.  Assign a category.
    * Check the **"cardsort_group_IDs"** sheet.
    * If the category already exists, paste its Name into **column H** and copy the formula from the cell above for **column I**.
    * If the category is new, add it to the list and continue the numbering.
    * Repeat this process for the **"cardsort_subgroup_IDs"** sheet and for **columns J and K**.
3.  Fill in the remaining columns.
    * For **column L**, copy the formula from the cell above.
    * For **columns M, N, and O**, copy the formulas from the cell above.
4.  Switch to the **"urls"** sheet to manage sources.
    * Add the new source in the first empty row.
    * Continue the numbering in **column A**.
    * Enter the display name (**column B**). Use the exact spelling if the source name is already listed.
    * Select the company size in **column C**.
    * Enter the source URL (**column D**).
    * If a research source mentions a company, add a new row with the same source number, but add a small letter (e.g., `1a`, `1b`). Enter the company's name in the new row and use the same URL.
5.  Return to the **"metrics"** sheet.
    * Add the new **source ID** to **column D** if it's a company or to **column E** if it's a research source.
    * Also, add the new source ID to any other metrics that are mentioned in that source.
6.  **Save and close** the Excel file.


### **2. Run the `parser.py`**
* Run the `parser.py` script to process the new data.
* **Note:** If you've changed the names of the Excel file or its sheets, remember to update these in the `parser.py` file before running the script.


### **3. Transfer the Data to the Server**
* Copy the newly generated **`data.json`** and **`source_ids.json`** files.
* Paste these files into the folder where the dashboard is running. This will update the dashboard with the new metrics.
