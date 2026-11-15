package dto

// OverviewResponse 是平台后台“实验数据”页的顶部概览。
type OverviewResponse struct {
	Sessions            int64            `json:"sessions"`
	Students            int64            `json:"students"`
	AvgScore            float64          `json:"avg_score"`
	AvgDurationMs       float64          `json:"avg_duration_ms"`
	GradeDistribution   map[string]int64 `json:"grade_distribution"`
	OutcomeDistribution []OutcomeCount   `json:"outcome_distribution"`
	DailyTrend          []DailyPoint     `json:"daily_trend"`
}

type OutcomeCount struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Count int64  `json:"count"`
}

type DailyPoint struct {
	Date     string  `json:"date"`
	Sessions int64   `json:"sessions"`
	AvgScore float64 `json:"avg_score"`
}

type ScenarioStat struct {
	ScenarioID    string  `json:"scenario_id"`
	ScenarioTitle string  `json:"scenario_title"`
	Sessions      int64   `json:"sessions"`
	Students      int64   `json:"students"`
	AvgScore      float64 `json:"avg_score"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
}

type ScenarioResponse struct {
	Items []ScenarioStat `json:"items"`
}

type DecisionStat struct {
	NodeID    string `json:"node_id"`
	NodeTitle string `json:"node_title"`
	OptionID  string `json:"option_id"`
	Label     string `json:"label"`
	Count     int64  `json:"count"`
}

type DecisionResponse struct {
	Items []DecisionStat `json:"items"`
	Total int64          `json:"total"`
}

type RuleStat struct {
	RuleID  string  `json:"rule_id"`
	Label   string  `json:"label"`
	Kind    string  `json:"kind"`
	Hits    int64   `json:"hits"`
	Total   int64   `json:"total"`
	HitRate float64 `json:"hit_rate"`
}

type RuleResponse struct {
	Items []RuleStat `json:"items"`
}
