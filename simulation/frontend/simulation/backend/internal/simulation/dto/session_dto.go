package dto

import "encoding/json"

// SessionUploadRequest 是前端 SessionRecord 中服务端需要索引的字段。
// 完整快照仍以原始 JSON 入库，避免字段演进时丢数据。
type SessionUploadRequest struct {
	ID              string         `json:"id"`
	ScenarioID      string         `json:"scenarioId"`
	ScenarioTitle   string         `json:"scenarioTitle"`
	ScenarioVersion string         `json:"scenarioVersion"`
	Domain          string         `json:"domain"`
	StartedAt       int64          `json:"startedAt"`
	FinishedAt      int64          `json:"finishedAt"`
	DurationMs      int64          `json:"durationMs"`
	Score           int            `json:"score"`
	Grade           string         `json:"grade"`
	GradeLabel      string         `json:"gradeLabel"`
	Outcome         SessionOutcome `json:"outcome"`
}

type SessionOutcome struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// SessionListQuery 是后台/个人历史查询条件。
type SessionListQuery struct {
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
	ScenarioID string `form:"scenario_id"`
	ClassID    uint   `form:"class_id"`
	UserID     uint   `form:"user_id"`
	Keyword    string `form:"keyword"`
	From       string `form:"from"`
	To         string `form:"to"`
}

type SessionItem struct {
	ID              string `json:"id"`
	UserID          uint   `json:"user_id"`
	Username        string `json:"username"`
	Nickname        string `json:"nickname"`
	ClassID         uint   `json:"class_id"`
	ClassName       string `json:"class_name"`
	ScenarioID      string `json:"scenario_id"`
	ScenarioTitle   string `json:"scenario_title"`
	ScenarioVersion string `json:"scenario_version"`
	Domain          string `json:"domain"`
	Score           int    `json:"score"`
	Grade           string `json:"grade"`
	GradeLabel      string `json:"grade_label"`
	OutcomeID       string `json:"outcome_id"`
	OutcomeTitle    string `json:"outcome_title"`
	DurationMs      int64  `json:"duration_ms"`
	StartedAt       int64  `json:"started_at"`
	FinishedAt      int64  `json:"finished_at"`
	ReceivedAt      int64  `json:"received_at"`
}

type SessionDetail struct {
	SessionItem
	Payload json.RawMessage `json:"payload"`
}

type SessionListResponse struct {
	Items    []SessionItem `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type UploadResponse struct {
	ID         string `json:"id"`
	ReceivedAt int64  `json:"received_at"`
}
