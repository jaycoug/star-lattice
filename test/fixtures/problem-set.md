# Problem set · a linear model for tree volume

A test fixture for the click-throughs (test/headless/qsetflow.js): five question sets, one per part, each to a child of **Statistics › Problem set**. Written for Star Lattice; it uses R's built-in `trees` data.

# Set: Part 1 · the data and a first model
target: Statistics > Problem set > 1.
context:
**Part 1 of 5.** R's built-in `trees` data measures 31 black cherry trees: girth (inches), height (feet) and volume (cubic feet). Fit a linear model for volume and read its summary.

| Column | Meaning |
|---|---|
| `Girth` | diameter at 4 ft 6 in (inches) |
| `Height` | height (feet) |
| `Volume` | volume of timber (cubic feet) |

## Q setup [step]
Open RStudio and start a new script (File › New File › R Script). Save it as `trees.R`, so every line of this problem set is kept in order. Run a line with **Ctrl+Enter**.

```r
options(digits = 4)
```

## Chain: Data and model
context:
Each answer is the code that goes in the blank. Type it into your script too, and run it.

### Q load [blank]
Complete the lines that open the `trees` data.
```r
____
head(trees)
```
answer: data(trees)
hint: `trees` ships with R, in the datasets package.
explain: `data()` loads a data set that comes with R or an attached package.

### Q factor [blank]
Complete the line that makes `size`, coded 1 small, 2 medium, 3 large, a labeled factor.
```r
trees$size <- cut(trees$Girth, 3, labels = FALSE)
____
```
answer: trees$size <- factor(trees$size, labels=c("Small","Medium","Large"))
hint: `labels` renames the sorted codes in order: 1, 2, 3.
explain: `labels` renames the sorted codes in order.

### Q refs [choice]
Which level of `size` is the reference in a model?
- [x] Small, the first level
- [ ] Large, the last level
  > The first level is the reference, and levels sort as stored: code 1 first.
- [ ] Medium, the middle level
  > The middle of the range plays no part; the stored order does.
- [ ] None: every level gets a coefficient
  > A factor with k levels gets k − 1 indicators.
explain: The first level is the reference: the model gets `sizeMedium` and `sizeLarge`, each compared with Small.

### Q model [blank]
Complete the model for volume with girth and height.
```r
fit <- lm(____, data=trees)
summary(fit)
```
answer: Volume~Girth+Height
hint: The response goes left of `~`.

## Chain: Reading summary(fit)
context:
Run `summary(fit)` in your console and read these off its output.

### Q events [number]
How many residual degrees of freedom does the model have?
answer: 28
hint: The `Residual standard error` line, near the bottom.

### Q hr-race [number]
The coefficient of `Girth`, to 3 decimals.
answer: 4.708
hint: The `Estimate` column of the `Girth` row.
explain: Each extra inch of girth adds about 4.7 cubic feet of volume, at the same height.

### Q p-age [number]
The multiple R-squared, to 3 decimals.
answer: 0.948
hint: The `Multiple R-squared` line.

## Q r-csfit [recall]
From memory: fit `fit`, the linear model of volume on girth and height.
answer: fit <- lm(Volume~Girth+Height, data=trees)
hint: `lm(formula, data=…)`.

---

# Set: Part 2 · residuals against height
target: Statistics > Problem set > 2.
context:
**Part 2 of 5.** Fit a model with height left out, plot its residuals against height with a lowess smoother, and say what the pattern suggests.

## Chain: The model without height

### Q mod2 [blank]
Complete the model for checking the form of height.
```r
fit2 <- lm(Volume~____, data=trees)
```
answer: Girth
hint: Every covariate of part 1 but one.

### Q leave-out [choice]
Why is `Height` left out before its residuals are plotted against height?
- [x] So the residuals show what the model misses about height, and their pattern suggests its form
- [ ] Residuals can't be computed for a covariate that's in the model
- [ ] Leaving it out makes the residuals sum to zero
  > Least-squares residuals sum to zero for any model with an intercept.
- [ ] It's how the leverage of each tree is computed

### Q mres [blank]
Complete the line that extracts the residuals of the model without height.
```r
res2 <- ____(fit2)
```
answer: residuals

### Q lowess [blank]
Complete the line that adds a lowess smoother to the plot.
```r
plot(trees$Height, res2)
lines(lowess(____), col=2)
```
answer: trees$Height, res2
hint: `lowess(x, y)` takes the same order as `plot(x, y)`.

## Chain: Reading the pattern

### Q run-mart [step]
Run the plot and `lines` lines, and look at the red smoother.

### Q read-mart [choice]
Which reading fits the smoother?
- [x] It rises with height: taller trees have more volume than girth alone predicts
- [ ] It stays flat at zero at every height
- [ ] It falls with height
- [ ] It's a U shape with its lowest point at 75 feet

### Q res-sign [choice]
A tree with a positive residual has…
- [x] more volume than the model without height expects
- [ ] less volume than the model without height expects
- [ ] exactly the volume the model expects

### Q meaning [choice]
What does the pattern suggest?
- [x] Height belongs in the model
- [ ] Height should be dropped
- [ ] Girth should be dropped

## Q r-mres [recall]
From memory: the residuals of `fit2`, as `res2`.
answer: res2 <- residuals(fit2)

---

# Set: Part 3 · a log scale
target: Statistics > Problem set > 3.
context:
**Part 3 of 5.** Volume grows roughly like girth squared times height: fit the model on a log scale.

## Chain: The log model

### Q logfit [blank]
Complete the model on the log scale.
```r
fit3 <- lm(log(Volume)~____, data=trees)
```
answer: log(Girth)+log(Height)

### Q log-girth [number]
The coefficient of `log(Girth)`, to 2 decimals.
answer: 1.98

### Q log-read [choice]
A coefficient near 2 for `log(Girth)` says that…
- [x] volume grows about as girth squared
- [ ] volume grows about linearly with girth
- [ ] girth doesn't matter on the log scale
- [ ] the model doesn't fit

## Q r-logfit [recall]
From memory: fit `fit3`, the log model.
answer: fit3 <- lm(log(Volume)~log(Girth)+log(Height), data=trees)

---

# Set: Part 4 · residuals and outliers
target: Statistics > Problem set > 4.
context:
**Part 4 of 5.** Look for trees the log model fits badly.

## Chain: Residuals against the fitted values

### Q lp [blank]
Complete the line that plots the residuals against the fitted values.
```r
plot(fitted(fit3), ____(fit3))
```
answer: residuals

### Q std-why [choice]
Why look at standardized residuals rather than raw ones?
- [x] They're on a common scale, so a value past 2 stands out whatever the units
- [ ] Raw residuals can't be computed for a log model
- [ ] Standardized residuals measure each tree's influence on the coefficients
- [ ] They also check the normality of the predictors

### Q stdplot [blank]
Complete the line that computes the standardized residuals.
```r
r3 <- ____(fit3)
```
answer: rstandard

## Chain: The largest residuals

### Q sortres [blank]
Complete the line that sorts the trees by the size of their standardized residual, largest first.
```r
head(order(____, decreasing=TRUE), 3)
```
answer: abs(r3)

### Q res-max [number]
The largest absolute standardized residual, to 2 decimals.
answer: 2.11

### Q res-count [number]
How many trees have an absolute standardized residual over 2?
answer: 1

### Q rows [step]
Print those three trees' rows with `trees[head(order(abs(r3), decreasing=TRUE), 3), ]`.

### Q common [choice]
What do the three trees have in common?
- [x] All three have average girth for their height
- [ ] All three are the tallest trees
- [ ] All three are the smallest trees
- [ ] All three were measured twice

### Q source [choice]
What should be done about them?
- [x] Check the measurements, and keep them unless one is a recording error
- [ ] Delete them and refit the model
- [ ] Nothing can be said about them
- [ ] Refit without the log scale

---

# Set: Part 5 · influence
target: Statistics > Problem set > 5.
context:
**Part 5 of 5.** Which tree moves the girth coefficient most?

## Chain: DFBETAS for girth

### Q dfbetas [blank]
Complete the line that computes the DFBETAS of the log model.
```r
dfb <- ____(fit3)
```
answer: dfbetas

### Q col [number]
Which column of `dfb` holds `log(Girth)`?
answer: 2

### Q dfb-sign [choice]
A tree with a large positive DFBETAS for `log(Girth)`…
- [x] raises the coefficient: without it, the coefficient would be lower
- [ ] lowers the coefficient: without it, the coefficient would be higher
- [ ] lowers the coefficient's standard error only
