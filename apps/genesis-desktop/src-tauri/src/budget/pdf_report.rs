// ─────────────────────────────────────────────────────────────────────────────
// Budget PDF Report Generator — printpdf 0.7
// Produces a professional A4 monthly financial report with charts,
// category breakdowns, health insights, bills, AI costs, and forecast.
// ─────────────────────────────────────────────────────────────────────────────

use printpdf::*;
use std::fs::File;
use std::io::BufWriter;

use super::{
    AiCostEntry, AiCostSummary, Bill, BudgetCategoryWithSpending, CashFlowProjection,
    FinancialHealthScore, MonthlyOverview,
};

// ── Color palette ──────────────────────────────────────────────────────────
const COLOR_PRIMARY: (f32, f32, f32) = (0.878, 0.353, 0.227); // #e05a3a
const COLOR_GREEN: (f32, f32, f32) = (0.133, 0.773, 0.369); // #22c55e
const COLOR_RED: (f32, f32, f32) = (0.937, 0.267, 0.267); // #ef4444
const COLOR_AMBER: (f32, f32, f32) = (0.961, 0.620, 0.043); // #f59e0b
const COLOR_DARK: (f32, f32, f32) = (0.15, 0.15, 0.15);
const COLOR_MUTED: (f32, f32, f32) = (0.55, 0.55, 0.55);
const COLOR_LIGHT_BG: (f32, f32, f32) = (0.95, 0.95, 0.95);
const COLOR_WHITE: (f32, f32, f32) = (1.0, 1.0, 1.0);

// Page dimensions (A4)
const PAGE_W: f32 = 210.0;
const PAGE_H: f32 = 297.0;
const MARGIN: f32 = 18.0;
const CONTENT_W: f32 = PAGE_W - 2.0 * MARGIN;

// ── Public entry point ─────────────────────────────────────────────────────

/// Generate a monthly financial report PDF and save it to the specified path.
/// Returns the number of pages generated.
#[allow(clippy::too_many_arguments)]
pub fn generate_report(
    path: &str,
    overview: &MonthlyOverview,
    categories: &[BudgetCategoryWithSpending],
    health: &FinancialHealthScore,
    bills: &[Bill],
    ai_entries: &[AiCostEntry],
    ai_summary: &[AiCostSummary],
    cash_flow: &[CashFlowProjection],
) -> Result<u32, String> {
    let (doc, page1, layer1) = PdfDocument::new(
        format!("Budget Report {}", overview.year_month),
        Mm(PAGE_W),
        Mm(PAGE_H),
        "Layer 1",
    );

    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Font error: {e}"))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Font error: {e}"))?;

    let mut page_count = 1u32;

    // ── Page 1: Title + Executive Summary ────────────────────────────
    {
        let layer = doc.get_page(page1).get_layer(layer1);
        draw_title_page(&layer, overview, &font, &font_bold);
    }

    // ── Page 2+: Category Breakdown ──────────────────────────────────
    if !categories.is_empty() {
        page_count += 1;
        let (page, l) = doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "categories");
        let layer = doc.get_page(page).get_layer(l);
        draw_section_header(&layer, "Category Breakdown", &font_bold, 0.0);
        draw_category_table(&layer, categories, &font, &font_bold, 35.0);
    }

    // ── Page: Financial Health ───────────────────────────────────────
    page_count += 1;
    {
        let (page, l) = doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "health");
        let layer = doc.get_page(page).get_layer(l);
        draw_financial_health(&layer, health, &font, &font_bold);
    }

    // ── Page: Bills Summary (if any) ─────────────────────────────────
    if !bills.is_empty() {
        page_count += 1;
        let (page, l) = doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "bills");
        let layer = doc.get_page(page).get_layer(l);
        draw_section_header(&layer, "Bills Summary", &font_bold, 0.0);
        draw_bills_table(&layer, bills, &font, &font_bold, 35.0);
    }

    // ── Page: AI Costs (if any) ──────────────────────────────────────
    if !ai_entries.is_empty() || !ai_summary.is_empty() {
        page_count += 1;
        let (page, l) = doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "ai_costs");
        let layer = doc.get_page(page).get_layer(l);
        draw_ai_costs(&layer, ai_summary, ai_entries, &font, &font_bold);
    }

    // ── Page: Cash Flow Forecast (if any) ────────────────────────────
    if !cash_flow.is_empty() {
        page_count += 1;
        let (page, l) = doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "forecast");
        let layer = doc.get_page(page).get_layer(l);
        draw_forecast(&layer, cash_flow, &font, &font_bold);
    }

    // ── Save ─────────────────────────────────────────────────────────
    let file = File::create(path).map_err(|e| format!("Cannot create {path}: {e}"))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("Save error: {e}"))?;

    Ok(page_count)
}

// ── Helper: set fill color on layer ────────────────────────────────────────

fn set_fill(layer: &PdfLayerReference, (r, g, b): (f32, f32, f32)) {
    layer.set_fill_color(Color::Rgb(Rgb::new(r, g, b, None)));
}

fn rect(layer: &PdfLayerReference, x: f32, y: f32, w: f32, h: f32) {
    let r = Rect::new(Mm(x), Mm(y), Mm(x + w), Mm(y + h));
    layer.add_rect(r);
}

fn text(layer: &PdfLayerReference, txt: &str, size: f32, x: f32, y: f32, font: &IndirectFontRef) {
    layer.use_text(txt, size, Mm(x), Mm(y), font);
}

fn text_color(layer: &PdfLayerReference, txt: &str, size: f32, x: f32, y: f32, font: &IndirectFontRef, color: (f32, f32, f32)) {
    set_fill(layer, color);
    layer.use_text(txt, size, Mm(x), Mm(y), font);
    set_fill(layer, COLOR_DARK);
}

fn fmt_euro(v: f64) -> String {
    format!("€{:.2}", v)
}

fn fmt_int(v: f64) -> String {
    format!("€{:.0}", v)
}

// ── Title Page ─────────────────────────────────────────────────────────────

fn draw_title_page(
    layer: &PdfLayerReference,
    overview: &MonthlyOverview,
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
) {
    // Accent bar at top
    set_fill(layer, COLOR_PRIMARY);
    rect(layer, 0.0, PAGE_H - 8.0, PAGE_W, 8.0);

    // Title
    text_color(layer, "MONTHLY FINANCIAL REPORT", 26.0, MARGIN, PAGE_H - 50.0, font_bold, COLOR_DARK);
    text_color(layer, &overview.year_month, 14.0, MARGIN, PAGE_H - 66.0, font, COLOR_MUTED);

    // Horizontal rule
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, MARGIN, PAGE_H - 76.0, CONTENT_W, 1.0);

    // Executive Summary box
    let box_top = PAGE_H - 110.0;
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, MARGIN, box_top, CONTENT_W, 70.0);

    text_color(layer, "Executive Summary", 12.0, MARGIN + 8.0, box_top + 55.0, font_bold, COLOR_DARK);

    text_color(layer, &format!("Total Income:   {}", fmt_euro(overview.total_income)), 10.0, MARGIN + 8.0, box_top + 40.0, font, COLOR_PRIMARY);
    text_color(layer, &format!("Total Expenses: {}", fmt_euro(overview.total_expenses)), 10.0, MARGIN + 8.0, box_top + 27.0, font, COLOR_RED);
    text_color(layer, &format!("Net Savings:    {}", fmt_euro(overview.net_savings)), 10.0, MARGIN + 8.0, box_top + 14.0, font, COLOR_GREEN);

    // Savings rate right side
    text_color(layer, &format!("{:.1}%", overview.savings_rate), 20.0, PAGE_W / 2.0 + 20.0, box_top + 40.0, font_bold, if overview.savings_rate >= 20.0 { COLOR_GREEN } else { COLOR_AMBER });
    text_color(layer, "Savings Rate", 9.0, PAGE_W / 2.0 + 20.0, box_top + 22.0, font, COLOR_MUTED);
    text_color(layer, &format!("{} transactions", overview.transaction_count), 9.0, PAGE_W / 2.0 + 20.0, box_top + 10.0, font, COLOR_MUTED);

    // Footer
    let footer_y = 20.0;
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, 0.0, 0.0, PAGE_W, 4.0);
    text_color(layer, "Generated by Bento Desktop — Intelligent Budget Planner", 7.0, MARGIN, footer_y, font, COLOR_MUTED);
    text_color(layer, "Page 1", 7.0, PAGE_W - MARGIN - 20.0, footer_y, font, COLOR_MUTED);
}

// ── Section Header ─────────────────────────────────────────────────────────

fn draw_section_header(layer: &PdfLayerReference, title: &str, font_bold: &IndirectFontRef, y: f32) {
    let top = PAGE_H - MARGIN - y;
    set_fill(layer, COLOR_PRIMARY);
    rect(layer, MARGIN, top, 4.0, 16.0);
    text_color(layer, title, 16.0, MARGIN + 12.0, top + 2.0, font_bold, COLOR_DARK);

    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, MARGIN, top - 6.0, CONTENT_W, 1.0);

    // Footer bar
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, 0.0, 0.0, PAGE_W, 4.0);
}

// ── Category Breakdown Table ───────────────────────────────────────────────

fn draw_category_table(
    layer: &PdfLayerReference,
    categories: &[BudgetCategoryWithSpending],
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
    start_y: f32,
) {
    // Special handling if many categories — we just render what fits
    let max_rows = 20;
    let rows = categories.len().min(max_rows);
    let row_h = 6.5;
    let table_top = PAGE_H - MARGIN - start_y - 10.0;
    let col_x = [MARGIN, MARGIN + 80.0, MARGIN + 130.0, MARGIN + 165.0, MARGIN + CONTENT_W - 10.0];

    // Header
    set_fill(layer, COLOR_PRIMARY);
    rect(layer, MARGIN, table_top, CONTENT_W, row_h + 4.0);
    let header_y = table_top + 2.0;

    set_fill(layer, COLOR_WHITE);
    text(layer, "Category", 8.0, col_x[0] + 4.0, header_y, font_bold);
    text(layer, "Budget", 8.0, col_x[1], header_y, font_bold);
    text(layer, "Spent", 8.0, col_x[2], header_y, font_bold);
    text(layer, "Remaining", 8.0, col_x[3], header_y, font_bold);
    text(layer, "Used", 8.0, col_x[4] - 20.0, header_y, font_bold);

    // Rows
    for (i, cat) in categories.iter().enumerate().take(rows) {
        let row_y = table_top - (i as f32 + 1.0) * row_h - 4.0;
        if row_y < 20.0 {
            break;
        }
        if i % 2 == 0 {
            set_fill(layer, COLOR_LIGHT_BG);
            rect(layer, MARGIN, row_y - 1.0, CONTENT_W, row_h);
        }

        let txt_color = if cat.percent_used >= 100.0 { COLOR_RED } else if cat.percent_used >= 80.0 { COLOR_AMBER } else { COLOR_DARK };
        let text_y = row_y + 1.0;

        text_color(layer, &truncate(&cat.name, 18), 7.0, col_x[0] + 4.0, text_y, font, txt_color);
        text_color(layer, &fmt_int(cat.monthly_budget), 7.0, col_x[1], text_y, font, COLOR_DARK);
        text_color(layer, &fmt_int(cat.spent), 7.0, col_x[2], text_y, font, if cat.spent > cat.monthly_budget { COLOR_RED } else { COLOR_DARK });
        text_color(layer, &fmt_int(cat.remaining), 7.0, col_x[3], text_y, font, if cat.remaining >= 0.0 { COLOR_GREEN } else { COLOR_RED });
        text_color(layer, &format!("{:.0}%", cat.percent_used), 7.0, col_x[4] - 20.0, text_y, font, txt_color);

        // Mini progress bar
        let bar_w = (cat.percent_used / 100.0 * 30.0).min(30.0);
        let bar_color = if cat.percent_used >= 100.0 { COLOR_RED } else if cat.percent_used >= 80.0 { COLOR_AMBER } else { COLOR_GREEN };
        // Background
        set_fill(layer, (0.9, 0.9, 0.9));
        rect(layer, 165.0, text_y - 1.5, 30.0, 4.0);
        // Fill
        if cat.percent_used > 0.0 {
            set_fill(layer, bar_color);
            rect(layer, 165.0, text_y - 1.5, bar_w as f32, 4.0);
        }
    }

    // Footer
    set_fill(layer, COLOR_MUTED);
    text_color(layer, "Page — Report generated by Bento Desktop", 7.0, MARGIN, 18.0, font, COLOR_MUTED);
}

// ── Financial Health ───────────────────────────────────────────────────────

fn draw_financial_health(
    layer: &PdfLayerReference,
    health: &FinancialHealthScore,
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
) {
    draw_section_header(layer, "Financial Health Assessment", font_bold, 0.0);

    // Score circle / large number
    let score_x = PAGE_W / 2.0;
    let score_y = PAGE_H - MARGIN - 60.0;

    // Background circle
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, score_x - 20.0, score_y - 20.0, 40.0, 40.0);
    // Actually let's draw a proper circle using the outline
    // For simplicity, draw a rounded-rect like badge
    set_fill(layer, health_color(health.score));
    rect(layer, score_x - 25.0, score_y - 15.0, 50.0, 30.0);

    set_fill(layer, COLOR_WHITE);
    text(layer, &format!("{}", health.score), 18.0, score_x - 8.0, score_y + 4.0, font_bold);
    text_color(layer, "/ 100", 8.0, score_x + 16.0, score_y - 4.0, font, COLOR_WHITE);

    // Grades
    let grades_y = score_y - 40.0;
    text_color(layer, &format!("Savings Rate:    {}  —  {}", health.savings_rate_grade, &health.savings_rate_grade), 9.0, MARGIN, grades_y, font, COLOR_DARK);
    text_color(layer, &format!("Budget Adherence: {}", health.budget_adherence), 9.0, MARGIN, grades_y - 10.0, font, COLOR_DARK);
    text_color(layer, &format!("Bill Payment:     {}", health.bill_payment_rate), 9.0, MARGIN, grades_y - 20.0, font, COLOR_DARK);
    text_color(layer, &format!("Debt/Income:      {}", health.debt_income_ratio), 9.0, MARGIN, grades_y - 30.0, font, COLOR_DARK);

    // Insights
    let insight_top = grades_y - 50.0;
    text_color(layer, "Key Insights", 11.0, MARGIN, insight_top, font_bold, COLOR_PRIMARY);

    for (i, insight) in health.insights.iter().enumerate().take(6) {
        let iy = insight_top - 12.0 - (i as f32) * 10.0;
        if iy < 20.0 { break; }
        // Bullet
        set_fill(layer, COLOR_PRIMARY);
        rect(layer, MARGIN, iy - 2.0, 4.0, 4.0);
        text_color(layer, insight, 7.5, MARGIN + 10.0, iy - 1.0, font, COLOR_DARK);
    }
}

fn health_color(score: u8) -> (f32, f32, f32) {
    if score >= 80 { COLOR_GREEN }
    else if score >= 60 { COLOR_AMBER }
    else if score >= 40 { (0.976, 0.451, 0.086) } // orange
    else { COLOR_RED }
}

// ── Bills Table ────────────────────────────────────────────────────────────

fn draw_bills_table(
    layer: &PdfLayerReference,
    bills: &[Bill],
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
    start_y: f32,
) {
    let row_h = 6.0;
    let max_rows = 25;
    let table_top = PAGE_H - MARGIN - start_y - 10.0;
    let col_x = [MARGIN, MARGIN + 90.0, MARGIN + 130.0, MARGIN + CONTENT_W - 30.0];

    // Header
    set_fill(layer, COLOR_PRIMARY);
    rect(layer, MARGIN, table_top, CONTENT_W, row_h + 4.0);
    set_fill(layer, COLOR_WHITE);
    text(layer, "Name", 8.0, col_x[0] + 4.0, table_top + 1.0, font_bold);
    text(layer, "Amount", 8.0, col_x[1], table_top + 1.0, font_bold);
    text(layer, "Due", 8.0, col_x[2], table_top + 1.0, font_bold);
    text(layer, "Status", 8.0, col_x[3], table_top + 1.0, font_bold);

    for (i, bill) in bills.iter().enumerate().take(max_rows) {
        let row_y = table_top - (i as f32 + 1.0) * row_h - 4.0;
        if row_y < 20.0 { break; }
        if i % 2 == 0 {
            set_fill(layer, COLOR_LIGHT_BG);
            rect(layer, MARGIN, row_y - 1.0, CONTENT_W, row_h);
        }

        let status = if bill.paid_this_month { "Paid ✓" } else { "Pending" };
        let status_color = if bill.paid_this_month { COLOR_GREEN } else { COLOR_RED };

        text(layer, &truncate(&bill.name, 20), 7.0, col_x[0] + 4.0, row_y, font);
        text_color(layer, &fmt_int(bill.amount), 7.0, col_x[1], row_y, font, COLOR_DARK);
        text(layer, &format!("Day {}", bill.due_day), 7.0, col_x[2], row_y, font);
        text_color(layer, status, 7.0, col_x[3], row_y, font, status_color);
    }
}

// ── AI Costs ───────────────────────────────────────────────────────────────

fn draw_ai_costs(
    layer: &PdfLayerReference,
    summary: &[AiCostSummary],
    _entries: &[AiCostEntry],
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
) {
    draw_section_header(layer, "AI Cost Summary", font_bold, 0.0);

    if !summary.is_empty() {
        let start_y = 45.0;
        let row_h = 6.0;
        let table_top = PAGE_H - MARGIN - start_y;
        let col_x = [MARGIN, MARGIN + 70.0, MARGIN + 120.0, MARGIN + CONTENT_W - 30.0];

        // Header
        set_fill(layer, COLOR_PRIMARY);
        rect(layer, MARGIN, table_top, CONTENT_W, row_h + 4.0);
        set_fill(layer, COLOR_WHITE);
        text(layer, "Provider", 8.0, col_x[0] + 4.0, table_top + 1.0, font_bold);
        text(layer, "Total Cost", 8.0, col_x[1], table_top + 1.0, font_bold);
        text(layer, "Tokens", 8.0, col_x[2], table_top + 1.0, font_bold);
        text(layer, "Months", 8.0, col_x[3], table_top + 1.0, font_bold);

        for (i, s) in summary.iter().enumerate().take(15) {
            let row_y = table_top - (i as f32 + 1.0) * row_h - 4.0;
            if row_y < 20.0 { break; }
            if i % 2 == 0 {
                set_fill(layer, COLOR_LIGHT_BG);
                rect(layer, MARGIN, row_y - 1.0, CONTENT_W, row_h);
            }
            text(layer, &s.provider, 7.0, col_x[0] + 4.0, row_y, font);
            text_color(layer, &fmt_euro(s.total_cost), 7.0, col_x[1], row_y, font, COLOR_DARK);
            text(layer, &format!("{}", (s.total_tokens_in + s.total_tokens_out)), 7.0, col_x[2], row_y, font);
            text(layer, &format!("{}", s.month_count), 7.0, col_x[3], row_y, font);
        }
    } else {
        text_color(layer, "No AI costs tracked this period.", 10.0, MARGIN, PAGE_H - MARGIN - 60.0, font, COLOR_MUTED);
    }
}

// ── Cash Flow Forecast ─────────────────────────────────────────────────────

fn draw_forecast(
    layer: &PdfLayerReference,
    cash_flow: &[CashFlowProjection],
    font: &IndirectFontRef,
    font_bold: &IndirectFontRef,
) {
    draw_section_header(layer, "Cash Flow Forecast", font_bold, 0.0);

    if cash_flow.is_empty() {
        text_color(layer, "Not enough data to generate a forecast.", 10.0, MARGIN, PAGE_H - MARGIN - 60.0, font, COLOR_MUTED);
        return;
    }

    // Simple bar chart
    let chart_left = MARGIN + 10.0;
    let chart_bottom = 40.0;
    let chart_w = CONTENT_W - 20.0;
    let chart_h = 140.0;

    // Find max balance for scaling
    let max_bal: f32 = cash_flow
        .iter()
        .map(|p| p.projected_balance.abs() as f32)
        .fold(1.0_f32, f32::max);

    let n = cash_flow.len();
    let bar_w = (chart_w / n as f32).min(20.0);
    let gap = (chart_w - bar_w * n as f32) / (n as f32 + 1.0);

    // Axis line
    set_fill(layer, COLOR_LIGHT_BG);
    rect(layer, chart_left, chart_bottom, chart_w, 1.0);

    for (i, proj) in cash_flow.iter().enumerate() {
        let bar_x = chart_left + gap + (bar_w + gap) * i as f32;
        let bar_h = (proj.projected_balance as f32 / max_bal * chart_h * 0.8).max(3.0);
        let bar_y = chart_bottom + 2.0;

        let bar_color = if proj.projected_balance >= 0.0 {
            COLOR_GREEN
        } else {
            COLOR_RED
        };

        set_fill(layer, bar_color);
        rect(layer, bar_x, bar_y, bar_w, bar_h);

        // Label
        text_color(
            layer,
            &proj.month[5..7],
            6.0,
            bar_x,
            bar_y - 8.0,
            font,
            COLOR_MUTED,
        );
    }

    // Table below chart
    let table_top = chart_bottom - 18.0;
    let col_x = [MARGIN, MARGIN + 60.0, MARGIN + 115.0, MARGIN + 170.0];

    text_color(layer, "Month", 7.0, col_x[0], table_top, font_bold, COLOR_PRIMARY);
    text_color(layer, "Income", 7.0, col_x[1], table_top, font_bold, COLOR_PRIMARY);
    text_color(layer, "Expenses", 7.0, col_x[2], table_top, font_bold, COLOR_PRIMARY);
    text_color(layer, "Balance", 7.0, col_x[3], table_top, font_bold, COLOR_PRIMARY);

    let row_h = 5.5;
    for (i, proj) in cash_flow.iter().enumerate().take(12) {
        let row_y = table_top - (i as f32 + 1.0) * row_h - 4.0;
        if row_y < 10.0 { break; }
        text(layer, &proj.month, 6.5, col_x[0], row_y, font);
        text_color(layer, &fmt_int(proj.projected_income), 6.5, col_x[1], row_y, font, COLOR_GREEN);
        text_color(layer, &fmt_int(proj.projected_expenses), 6.5, col_x[2], row_y, font, COLOR_RED);
        let bal_color = if proj.projected_balance >= 0.0 { COLOR_GREEN } else { COLOR_RED };
        text_color(layer, &fmt_int(proj.projected_balance), 6.5, col_x[3], row_y, font, bal_color);
    }
}

// ── Utils ──────────────────────────────────────────────────────────────────

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(max - 1).collect::<String>())
    }
}
