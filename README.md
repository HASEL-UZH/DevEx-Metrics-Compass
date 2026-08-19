# DX-Metrics-Compass
Interactive dashboard for navigating developer experience metrics across research and industry. Explore and compare metrics from SPACE, DORA, and beyond through configurable perspectives to find what's worth measuring in your context.

## Paper

The Compass and the analysis behind it are described in our article in *ACM Queue*:

> André N. Meyer, Patrick Meyer, Gail C. Murphy, and Thomas Fritz. 2026.
> **Too Many DevEx Metrics, Too Little Guidance — DevEx Metrics Compass: Making Sense of Developer Experience Measurement.**
> *ACM Queue* 24, 4. https://doi.org/10.1145/3831360

Short link: [devexcompass.com/paper](https://devexcompass.com/paper)

If you use the Compass or the dataset in your own work, please cite the article.

<details>
<summary>BibTeX</summary>

```bibtex
@article{meyer2026devexcompass,
  author  = {Meyer, Andr\'{e} N. and Meyer, Patrick and Murphy, Gail C. and Fritz, Thomas},
  title   = {Too Many DevEx Metrics, Too Little Guidance: DevEx Metrics Compass --- Making Sense of Developer Experience Measurement},
  journal = {ACM Queue},
  volume  = {24},
  number  = {4},
  year    = {2026},
  issn    = {1542-7730},
  doi     = {10.1145/3831360},
  url     = {https://doi.org/10.1145/3831360},
  publisher = {Association for Computing Machinery}
}
```

</details>

## License

This repository is licensed in two parts:

- **Compass (code)** — the web app in `compass/` is released under the [MIT License](compass/LICENSE).
- **Dataset** — the metrics catalogue in `dataset/` is released under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](dataset/LICENSE). In short: you are free to share and adapt the catalogue, including commercially, as long as you (a) **give credit** and link to the license, and (b) **share any adaptation under the same license** (ShareAlike). This covers the curation, structure, and taxonomy of the catalogue; the underlying referenced works retain their own rights.

  Suggested attribution: *"DX Metrics Compass dataset by Meyer, Meyer, Murphy & Fritz, HASEL, University of Zurich, licensed under CC BY-SA 4.0."* For academic use, please cite the [paper](https://doi.org/10.1145/3831360) as well.

Copyright (c) 2026 André Meyer, Patrick Meyer, Gail Murphy, and Thomas Fritz, HASEL, University of Zurich.
