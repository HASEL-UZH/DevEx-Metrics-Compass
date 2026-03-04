import pandas as pd
from math import isnan
import json
from itertools import cycle

# set names of excel and sheets
metrics_excel = "final_list_of_metrics.xlsx"
sheet_with_metrics = "metrics"
sheet_with_sources = "urls"

# import sheet with metrics from file
df = pd.read_excel(metrics_excel, sheet_name=sheet_with_metrics, engine="openpyxl")
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]  # drop phantom columns from Excel

rows_before = len(df)
df = df.dropna()
rows_dropped = rows_before - len(df)
if rows_dropped > 0:
    print(f"Warning: {rows_dropped} row(s) dropped due to missing values.")

# convert 'Company' and 'Research' columns to string type
df['Company'] = df['Company'].astype(str)
df['Research'] = df['Research'].astype(str)

# create dictionnary of cardsort groups
cardsort_groups = {}
for idx, series in df.iterrows():
    cardsort_groups[series["Cardsort Group ID"]] = series["Cardsort Group"]


# create dictionnary of cardsort sub groups
cardsort_sub_groups = {}
cardsort_sub_groups_to_groups_matching = {}

for idx, series in df.iterrows():
    cardsort_sub_groups[series["Cardsort Subgroup ID"]] = series["Cardsort Subgroup"]
    cardsort_sub_groups_to_groups_matching[series["Cardsort Subgroup ID"]] = series["Cardsort Group ID"]

# set master parent node
master_node_name = "Developer Experience Metrics"
master_node_id = 9999

# create entry for master node for json file.
master_list_of_dicts = [{
    "name": master_node_name,
    "id": master_node_id,
    "normal": {"fill": "#1B1AFF"}
}]

# provide a list of color codes. Cycles automatically if more groups than colors.
list_of_colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
color_cycle = cycle(list_of_colors)

# create the cardsort group entries for the json file.
cardsort_group_list_of_dicts = []
for key, value in cardsort_groups.items():
    cardsort_group_list_of_dicts.append({
        "name": value,
        "id": key,
        "parent": master_node_id,
        "normal": {"fill": next(color_cycle)}
    })

# create the cardsort sub group entries for the json file.
cardsort_sub_group_list_of_dicts = []
for key, value in cardsort_sub_groups.items():
    parent = cardsort_sub_groups_to_groups_matching[key]
    cardsort_sub_group_list_of_dicts.append({
        "name": value,
        "id": key,
        "parent": parent
    })

# create the metrics entries for the json file.
metrics_list_of_dicts = []
for idx, series in df.iterrows():

    # Sort synonyms alphabetically
    synonyms_unsorted = series["AlsoKnownAs"].split("; ")
    synonyms_sorted = sorted(synonyms_unsorted)
    alsoknownas = ("; ").join(synonyms_sorted)

    # create entry for every metric
    metrics_list_of_dicts.append({
        "name": series["Name"],
        "id": series["id"],
        "parent": series["Cardsort Subgroup ID"],
        "alsoknownas": alsoknownas,
        "company": series["Company"],
        "research": series["Research"],
        "type": series["Qual vs. quant"],
        "value": series["value"],
        "company_mentions": series["Number of companies"],
        "research_mentions": series["Number of research"],
        "description": series["Definition"],
        "is_research": series["IS_Research"],
        "bigcompany": series["IS_BigCompany"]
    })

# combine all entries into one list
json_list = master_list_of_dicts + cardsort_group_list_of_dicts + cardsort_sub_group_list_of_dicts + metrics_list_of_dicts

# create json file for metrics
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(json_list, f, ensure_ascii=False, indent=4)

print(f"data.json written with {len(metrics_list_of_dicts)} metrics.")


# import sheet with urls from file
df = pd.read_excel(metrics_excel, sheet_name=sheet_with_sources, engine="openpyxl")
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
df = df.dropna()

# convert 'Company' and 'Research' columns to string type
df['ref_number'] = df['ref_number'].astype(str)

source_ids = []

# create entry for every source
for idx, series in df.iterrows():
    source_ids.append({
        "ref_number": series["ref_number"],
        "ref_name": series["ref_name"],
        "ref_link": series["ref_link"]
    })

# create json file for source ids and urls
with open('source_ids.json', 'w', encoding='utf-8') as f:
    json.dump(source_ids, f, ensure_ascii=False, indent=4)

print(f"source_ids.json written with {len(source_ids)} sources.")
