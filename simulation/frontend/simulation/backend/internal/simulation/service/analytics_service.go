package service

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"sort"
	"strconv"

	"webGL-720yun/internal/simulation/dto"
	"webGL-720yun/internal/simulation/repository"
)

type AnalyticsService struct {
	repo  *repository.SessionRepository
	scope *ScopeBuilder
}

func NewAnalyticsService(repo *repository.SessionRepository) *AnalyticsService {
	return &AnalyticsService{
		repo:  repo,
		scope: NewScopeBuilder(repo),
	}
}

func (s *AnalyticsService) Scope(userID uint, role string, isSuper bool) (repository.Scope, error) {
	return s.scope.Build(userID, role, isSuper)
}

func (s *AnalyticsService) Overview(scope repository.Scope, filter repository.Filter) (*dto.OverviewResponse, error) {
	summary, err := s.repo.Summary(scope, filter)
	if err != nil {
		return nil, err
	}
	grades, err := s.repo.GradeDistribution(scope, filter)
	if err != nil {
		return nil, err
	}
	outcomes, err := s.repo.OutcomeDistribution(scope, filter, 20)
	if err != nil {
		return nil, err
	}
	daily, err := s.repo.DailyTrend(scope, filter)
	if err != nil {
		return nil, err
	}

	for _, grade := range []string{"A", "B", "C", "D"} {
		if _, ok := grades[grade]; !ok {
			grades[grade] = 0
		}
	}

	outcomeItems := make([]dto.OutcomeCount, 0, len(outcomes))
	for _, row := range outcomes {
		outcomeItems = append(outcomeItems, dto.OutcomeCount{
			ID:    row.ID,
			Title: row.Title,
			Count: row.Count,
		})
	}
	dailyItems := make([]dto.DailyPoint, 0, len(daily))
	for _, row := range daily {
		dailyItems = append(dailyItems, dto.DailyPoint{
			Date:     row.Date,
			Sessions: row.Sessions,
			AvgScore: round2(row.AvgScore),
		})
	}

	return &dto.OverviewResponse{
		Sessions:            summary.Sessions,
		Students:            summary.Students,
		AvgScore:            round2(summary.AvgScore),
		AvgDurationMs:       round2(summary.AvgDurationMs),
		GradeDistribution:   grades,
		OutcomeDistribution: outcomeItems,
		DailyTrend:          dailyItems,
	}, nil
}

func (s *AnalyticsService) Scenarios(scope repository.Scope, filter repository.Filter) (*dto.ScenarioResponse, error) {
	rows, err := s.repo.ScenarioStats(scope, filter)
	if err != nil {
		return nil, err
	}
	items := make([]dto.ScenarioStat, 0, len(rows))
	for _, row := range rows {
		items = append(items, dto.ScenarioStat{
			ScenarioID:    row.ScenarioID,
			ScenarioTitle: row.ScenarioTitle,
			Sessions:      row.Sessions,
			Students:      row.Students,
			AvgScore:      round2(row.AvgScore),
			AvgDurationMs: round2(row.AvgDurationMs),
		})
	}
	return &dto.ScenarioResponse{Items: items}, nil
}

type decisionPayload struct {
	Decisions []struct {
		NodeID    string `json:"nodeId"`
		NodeTitle string `json:"nodeTitle"`
		OptionID  string `json:"optionId"`
		Label     string `json:"label"`
	} `json:"decisions"`
}

func (s *AnalyticsService) Decisions(scope repository.Scope, filter repository.Filter) (*dto.DecisionResponse, error) {
	rows, err := s.repo.Payloads(scope, filter, 5000)
	if err != nil {
		return nil, err
	}

	type key struct {
		nodeID   string
		optionID string
	}
	counts := make(map[key]*dto.DecisionStat)
	for _, row := range rows {
		var payload decisionPayload
		if err := json.Unmarshal(row.Payload, &payload); err != nil {
			continue
		}
		for _, decision := range payload.Decisions {
			k := key{nodeID: decision.NodeID, optionID: decision.OptionID}
			item, ok := counts[k]
			if !ok {
				item = &dto.DecisionStat{
					NodeID:    decision.NodeID,
					NodeTitle: decision.NodeTitle,
					OptionID:  decision.OptionID,
					Label:     decision.Label,
				}
				counts[k] = item
			}
			item.Count++
		}
	}

	items := make([]dto.DecisionStat, 0, len(counts))
	for _, item := range counts {
		items = append(items, *item)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Count == items[j].Count {
			if items[i].NodeID == items[j].NodeID {
				return items[i].OptionID < items[j].OptionID
			}
			return items[i].NodeID < items[j].NodeID
		}
		return items[i].Count > items[j].Count
	})

	return &dto.DecisionResponse{Items: items, Total: int64(len(rows))}, nil
}

type rulePayload struct {
	Rules []struct {
		ID      string `json:"id"`
		Label   string `json:"label"`
		Kind    string `json:"kind"`
		Matched bool   `json:"matched"`
	} `json:"rules"`
}

func (s *AnalyticsService) Rules(scope repository.Scope, filter repository.Filter) (*dto.RuleResponse, error) {
	rows, err := s.repo.Payloads(scope, filter, 5000)
	if err != nil {
		return nil, err
	}

	type ruleAgg struct {
		label string
		kind  string
		hits  int64
		total int64
	}
	aggs := make(map[string]*ruleAgg)
	for _, row := range rows {
		var payload rulePayload
		if err := json.Unmarshal(row.Payload, &payload); err != nil {
			continue
		}
		for _, rule := range payload.Rules {
			agg, ok := aggs[rule.ID]
			if !ok {
				agg = &ruleAgg{label: rule.Label, kind: rule.Kind}
				aggs[rule.ID] = agg
			}
			agg.total++
			if rule.Matched {
				agg.hits++
			}
		}
	}

	items := make([]dto.RuleStat, 0, len(aggs))
	for id, agg := range aggs {
		rate := 0.0
		if agg.total > 0 {
			rate = round4(float64(agg.hits) / float64(agg.total))
		}
		items = append(items, dto.RuleStat{
			RuleID:  id,
			Label:   agg.label,
			Kind:    agg.kind,
			Hits:    agg.hits,
			Total:   agg.total,
			HitRate: rate,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].HitRate == items[j].HitRate {
			return items[i].RuleID < items[j].RuleID
		}
		return items[i].HitRate > items[j].HitRate
	})

	return &dto.RuleResponse{Items: items}, nil
}

func (s *AnalyticsService) ExportCSV(scope repository.Scope, filter repository.Filter) ([]byte, error) {
	rows, err := s.repo.ExportRows(scope, filter, 10000)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // Excel 识别 UTF-8
	writer := csv.NewWriter(&buf)
	_ = writer.Write([]string{
		"学号", "姓名", "班级", "实验场景", "分数", "等级", "结局", "用时(秒)", "开始时间", "结束时间",
	})
	for i := range rows {
		row := &rows[i]
		_ = writer.Write([]string{
			row.Username,
			row.Nickname,
			row.ClassName,
			row.ScenarioTitle,
			strconv.Itoa(row.Score),
			row.Grade,
			row.OutcomeTitle,
			strconv.FormatFloat(float64(row.DurationMs)/1000, 'f', 1, 64),
			row.StartedAt.Format("2006-01-02 15:04:05"),
			row.FinishedAt.Format("2006-01-02 15:04:05"),
		})
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func round2(value float64) float64 {
	return float64(int64(value*100+0.5)) / 100
}

func round4(value float64) float64 {
	return float64(int64(value*10000+0.5)) / 10000
}
