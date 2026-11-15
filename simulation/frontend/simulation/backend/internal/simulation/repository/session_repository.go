package repository

import (
	"encoding/json"
	"errors"
	"time"

	"webGL-720yun/internal/model"

	"gorm.io/gorm"
)

var ErrSessionOwnedByAnotherUser = errors.New("session id already owned by another user")

type Scope struct {
	UserID   uint
	Role     string
	IsAdmin  bool
	ClassIDs []uint
}

type Filter struct {
	ScenarioID string
	ClassID    uint
	UserID     uint
	Keyword    string
	From       *time.Time
	To         *time.Time
	Page       int
	PageSize   int
}

type SessionRow struct {
	model.SimSession
	Username  string `gorm:"column:username"`
	Nickname  string `gorm:"column:nickname"`
	ClassID   uint   `gorm:"column:class_id"`
	ClassName string `gorm:"column:class_name"`
}

type SummaryRow struct {
	Sessions      int64   `gorm:"column:sessions"`
	Students      int64   `gorm:"column:students"`
	AvgScore      float64 `gorm:"column:avg_score"`
	AvgDurationMs float64 `gorm:"column:avg_duration_ms"`
}

type CountRow struct {
	Key   string `gorm:"column:key"`
	Count int64  `gorm:"column:count"`
}

type OutcomeRow struct {
	ID    string `gorm:"column:outcome_id"`
	Title string `gorm:"column:outcome_title"`
	Count int64  `gorm:"column:count"`
}

type DailyRow struct {
	Date     string  `gorm:"column:date"`
	Sessions int64   `gorm:"column:sessions"`
	AvgScore float64 `gorm:"column:avg_score"`
}

type ScenarioRow struct {
	ScenarioID    string  `gorm:"column:scenario_id"`
	ScenarioTitle string  `gorm:"column:scenario_title"`
	Sessions      int64   `gorm:"column:sessions"`
	Students      int64   `gorm:"column:students"`
	AvgScore      float64 `gorm:"column:avg_score"`
	AvgDurationMs float64 `gorm:"column:avg_duration_ms"`
}

type PayloadRow struct {
	ID      string          `gorm:"column:id"`
	Payload json.RawMessage `gorm:"column:payload"`
}

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) baseQuery(scope Scope, filter Filter) *gorm.DB {
	db := r.db.Table("sim_session").
		Joins("LEFT JOIN sys_users u ON u.id = sim_session.user_id AND u.deleted_at IS NULL").
		Joins("LEFT JOIN sys_classes c ON c.id = u.class_id")

	switch {
	case scope.IsAdmin || scope.Role == model.RoleAdmin:
		// 管理员不受用户/班级范围限制。
	case scope.Role == model.RoleTeacher:
		if len(scope.ClassIDs) == 0 {
			return db.Where("1 = 0")
		}
		db = db.Where("u.class_id IN ?", scope.ClassIDs)
	default:
		if scope.UserID > 0 {
			db = db.Where("sim_session.user_id = ?", scope.UserID)
		}
	}

	if filter.ClassID > 0 {
		db = db.Where("u.class_id = ?", filter.ClassID)
	}
	if filter.UserID > 0 {
		db = db.Where("sim_session.user_id = ?", filter.UserID)
	}
	if filter.ScenarioID != "" {
		db = db.Where("sim_session.scenario_id = ?", filter.ScenarioID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		db = db.Where("(u.username LIKE ? OR u.nickname LIKE ?)", like, like)
	}
	if filter.From != nil {
		db = db.Where("sim_session.finished_at >= ?", *filter.From)
	}
	if filter.To != nil {
		db = db.Where("sim_session.finished_at < ?", *filter.To)
	}
	return db
}

// Upsert 按 session.id 幂等写入。已存在且属于其他用户时返回冲突错误。
func (r *SessionRepository) Upsert(session *model.SimSession) (bool, error) {
	created := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var existing model.SimSession
		err := tx.Select("id", "user_id", "received_at").Where("id = ?", session.ID).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			created = true
			return tx.Create(session).Error
		}
		if err != nil {
			return err
		}
		if existing.UserID != session.UserID {
			return ErrSessionOwnedByAnotherUser
		}

		session.ReceivedAt = existing.ReceivedAt
		return tx.Model(&model.SimSession{}).
			Where("id = ? AND user_id = ?", session.ID, session.UserID).
			Updates(map[string]interface{}{
				"scenario_id":      session.ScenarioID,
				"scenario_title":   session.ScenarioTitle,
				"scenario_version": session.ScenarioVersion,
				"domain":           session.Domain,
				"score":            session.Score,
				"grade":            session.Grade,
				"grade_label":      session.GradeLabel,
				"outcome_id":       session.OutcomeID,
				"outcome_title":    session.OutcomeTitle,
				"duration_ms":      session.DurationMs,
				"started_at":       session.StartedAt,
				"finished_at":      session.FinishedAt,
				"payload":          session.Payload,
			}).Error
	})
	return created, err
}

func (r *SessionRepository) FindByID(scope Scope, id string) (*SessionRow, error) {
	var row SessionRow
	err := r.baseQuery(scope, Filter{}).
		Select("sim_session.*, u.username, u.nickname, u.class_id, c.name AS class_name").
		Where("sim_session.id = ?", id).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, gorm.ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *SessionRepository) List(scope Scope, filter Filter) ([]SessionRow, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	base := r.baseQuery(scope, filter)
	var total int64
	if err := base.Distinct("sim_session.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []SessionRow
	err := r.baseQuery(scope, filter).
		Select("sim_session.*, u.username, u.nickname, u.class_id, c.name AS class_name").
		Order("sim_session.finished_at DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Scan(&rows).Error
	return rows, total, err
}

func (r *SessionRepository) Summary(scope Scope, filter Filter) (*SummaryRow, error) {
	var row SummaryRow
	err := r.baseQuery(scope, filter).
		Select(`COUNT(*) AS sessions,
			COUNT(DISTINCT sim_session.user_id) AS students,
			COALESCE(AVG(sim_session.score), 0) AS avg_score,
			COALESCE(AVG(sim_session.duration_ms), 0) AS avg_duration_ms`).
		Scan(&row).Error
	return &row, err
}

func (r *SessionRepository) GradeDistribution(scope Scope, filter Filter) (map[string]int64, error) {
	var rows []CountRow
	err := r.baseQuery(scope, filter).
		Select("sim_session.grade AS `key`, COUNT(*) AS count").
		Group("sim_session.grade").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]int64, len(rows))
	for _, row := range rows {
		result[row.Key] = row.Count
	}
	return result, nil
}

func (r *SessionRepository) OutcomeDistribution(scope Scope, filter Filter, limit int) ([]OutcomeRow, error) {
	if limit <= 0 {
		limit = 20
	}
	var rows []OutcomeRow
	err := r.baseQuery(scope, filter).
		Select("sim_session.outcome_id, sim_session.outcome_title, COUNT(*) AS count").
		Group("sim_session.outcome_id, sim_session.outcome_title").
		Order("count DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func (r *SessionRepository) DailyTrend(scope Scope, filter Filter) ([]DailyRow, error) {
	var rows []DailyRow
	err := r.baseQuery(scope, filter).
		Select("DATE_FORMAT(sim_session.finished_at, '%Y-%m-%d') AS date, COUNT(*) AS sessions, COALESCE(AVG(sim_session.score), 0) AS avg_score").
		Group("DATE_FORMAT(sim_session.finished_at, '%Y-%m-%d')").
		Order("date ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *SessionRepository) ScenarioStats(scope Scope, filter Filter) ([]ScenarioRow, error) {
	var rows []ScenarioRow
	err := r.baseQuery(scope, filter).
		Select(`sim_session.scenario_id,
			MAX(sim_session.scenario_title) AS scenario_title,
			COUNT(*) AS sessions,
			COUNT(DISTINCT sim_session.user_id) AS students,
			COALESCE(AVG(sim_session.score), 0) AS avg_score,
			COALESCE(AVG(sim_session.duration_ms), 0) AS avg_duration_ms`).
		Group("sim_session.scenario_id").
		Order("sessions DESC").
		Scan(&rows).Error
	return rows, err
}

func (r *SessionRepository) Payloads(scope Scope, filter Filter, limit int) ([]PayloadRow, error) {
	if limit <= 0 {
		limit = 5000
	}
	var rows []PayloadRow
	err := r.baseQuery(scope, filter).
		Select("sim_session.id, sim_session.payload").
		Order("sim_session.finished_at DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func (r *SessionRepository) ExportRows(scope Scope, filter Filter, limit int) ([]SessionRow, error) {
	if limit <= 0 {
		limit = 10000
	}
	var rows []SessionRow
	err := r.baseQuery(scope, filter).
		Select("sim_session.*, u.username, u.nickname, u.class_id, c.name AS class_name").
		Order("sim_session.finished_at DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func (r *SessionRepository) TeacherClassIDs(teacherID uint) ([]uint, error) {
	var ids []uint
	err := r.db.Model(&model.Class{}).Where("teacher_id = ?", teacherID).Pluck("id", &ids).Error
	return ids, err
}
