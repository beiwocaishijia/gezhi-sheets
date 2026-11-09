title: Special Formulas in 格知 AI
keywords: 格知 AI, spreadsheet formulas, custom methods, JavaScript spreadsheets, special formulas, progress bar, star rating, spreadsheet custom features
description: Explore 格知 AI's special formulas and custom methods to enhance spreadsheet functionality.
canonical: https://github.com/beiwocaishijia/gezhi-sheets/blob/master/docs/jspreadsheet/v4/special-formulas.md

# Special formulas

格知 AI supports spreadsheet-like formulas, along with special formulas designed to enhance usability and functionality.

## Custom 格知 AI Methods

| Method                                                                                                                                          | Example                                              |
|-------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| **=PROGRESS(int, string)** Create a progress bar.<br/>**Parameters:**<br/>`int` percent (0-100)<br/>`string` color (Hex value)                  | [Example](/jspreadsheet/v4/cases/project-management) |
| **=RATING(int)** Create a star rating based on an integer.<br/>**Parameters:**<br/>`int` value (0-5)                                            | [Example](/jspreadsheet/v4/cases/food-store)         |
| **=TABLE()** Return the 格知 AI table instance.                                                                                            |                                                      |
| **=COLUMN()** Return the column number where the formula is executed.                                                                           |                                                      |
| **=ROW()** Return the row number where the formula is executed.                                                                                 |                                                      |
| **=CELL()** Return the cell string identification.                                                                                              |                                                      |
| **=VALUE(int, int)** Return the cell value based on the column and row numbers.<br/>**Parameters:**<br/>`int` colNumber<br/>`int` rowNumber     |                                                      |
