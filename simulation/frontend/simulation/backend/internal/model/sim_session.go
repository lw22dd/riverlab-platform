package model

import (
	"encoding/json"
	"time"
)

// SimSession 保存一次伦理仿真实验的完整快照。
//
// 高频查询字段单独成列，完整 SessionRecord 放在 payload 里，
// 后续需要做决策/规则明细分析时再从 JSON 中解析。
type SimSession struct {
	ID string `gorm:"primaryKey;type:varchar(64);column:id" json:"id"`

	UserID uint `gorm:"not null;index:idx_sim_user_finished,priority:1;column:user_id" json:"user_id"`

	ScenarioID      string `gorm:"type:varchar(64);not null;index:idx_sim_scenario_finished,priority:1;column:scenario_id" json:"scenario_id"`
	ScenarioTitle   string `gorm:"type:varchar(200);column:scenario_title" json:"scenario_title"`
	ScenarioVersion string `gorm:"type:varchar(32);column:scenario_version" json:"scenario_version"`
	Domain          string `gorm:"type:varchar(32);column:domain" json:"domain"`

	Score      int    `gorm:"column:score;index" json:"score"`
	Grade      string `gorm:"type:varchar(8);column:grade;index" json:"grade"`
	GradeLabel string `gorm:"type:varchar(32);column:grade_label" json:"grade_label"`

	OutcomeID    string `gorm:"type:varchar(64);column:outcome_id;index" json:"outcome_id"`
	OutcomeTitle string `gorm:"type:varchar(200);column:outcome_title" json:"outcome_title"`

	DurationMs int64 `gorm:"column:duration_ms" json:"duration_ms"`

	StartedAt  time.Time `gorm:"column:started_at;index" json:"started_at"`
	FinishedAt time.Time `gorm:"column:finished_at;index:idx_sim_user_finished,priority:2;index:idx_sim_scenario_finished,priority:2;index:idx_sim_finished" json:"finished_at"`

	Payload    json.RawMessage `gorm:"type:json;column:payload" json:"-"`
	ReceivedAt time.Time       `gorm:"column:received_at;index" json:"received_at"`

	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (SimSession) TableName() string {
	return "sim_session"
}
