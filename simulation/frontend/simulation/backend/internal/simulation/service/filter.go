package service

import (
	"errors"
	"strings"
	"time"

	"webGL-720yun/internal/simulation/dto"
	"webGL-720yun/internal/simulation/repository"
)

// ToFilter 把查询参数转换为仓储层过滤条件。
// 支持 YYYY-MM-DD（按本地时区整天）和 RFC3339 两种时间格式。
func ToFilter(query *dto.SessionListQuery) (repository.Filter, error) {
	filter := repository.Filter{
		Page:       1,
		PageSize:   20,
		ScenarioID: strings.TrimSpace(query.ScenarioID),
		ClassID:    query.ClassID,
		UserID:     query.UserID,
		Keyword:    strings.TrimSpace(query.Keyword),
	}
	if query.Page > 0 {
		filter.Page = query.Page
	}
	if query.PageSize > 0 {
		filter.PageSize = query.PageSize
	}

	from, err := parseTimeBoundary(query.From, false)
	if err != nil {
		return filter, err
	}
	to, err := parseTimeBoundary(query.To, true)
	if err != nil {
		return filter, err
	}
	if from != nil && to != nil && !to.After(*from) {
		return filter, errors.New("结束时间必须晚于开始时间")
	}
	filter.From = from
	filter.To = to
	return filter, nil
}

func parseTimeBoundary(value string, isEnd bool) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	if t, err := time.ParseInLocation("2006-01-02", value, time.Local); err == nil {
		if isEnd {
			t = t.AddDate(0, 0, 1)
		}
		return &t, nil
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return &t, nil
	}
	return nil, errors.New("时间格式应为 YYYY-MM-DD 或 RFC3339")
}
