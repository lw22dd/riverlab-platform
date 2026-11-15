package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"webGL-720yun/internal/model"
	"webGL-720yun/internal/simulation/dto"
	"webGL-720yun/internal/simulation/repository"

	"gorm.io/gorm"
)

var (
	ErrInvalidSession   = errors.New("会话数据不合法")
	ErrSessionNotFound  = errors.New("会话不存在")
	ErrSessionForbidden = errors.New("无权访问该会话")
	ErrSessionConflict  = repository.ErrSessionOwnedByAnotherUser
)

const maxSessionPayloadSize = 2 << 20

type ScopeBuilder struct {
	repo *repository.SessionRepository
}

func NewScopeBuilder(repo *repository.SessionRepository) *ScopeBuilder {
	return &ScopeBuilder{repo: repo}
}

func (b *ScopeBuilder) Build(userID uint, role string, isSuper bool) (repository.Scope, error) {
	scope := repository.Scope{
		UserID:  userID,
		Role:    role,
		IsAdmin: isSuper || role == model.RoleAdmin,
	}
	if role == model.RoleTeacher {
		ids, err := b.repo.TeacherClassIDs(userID)
		if err != nil {
			return scope, err
		}
		scope.ClassIDs = ids
	}
	return scope, nil
}

type SessionService struct {
	repo  *repository.SessionRepository
	scope *ScopeBuilder
}

func NewSessionService(repo *repository.SessionRepository) *SessionService {
	return &SessionService{
		repo:  repo,
		scope: NewScopeBuilder(repo),
	}
}

func (s *SessionService) Scope(userID uint, role string, isSuper bool) (repository.Scope, error) {
	return s.scope.Build(userID, role, isSuper)
}

func (s *SessionService) Submit(userID uint, raw []byte) (*dto.UploadResponse, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("%w: 请求体为空", ErrInvalidSession)
	}
	if len(raw) > maxSessionPayloadSize {
		return nil, fmt.Errorf("%w: 会话数据超过 2MiB 限制", ErrInvalidSession)
	}

	var req dto.SessionUploadRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return nil, fmt.Errorf("%w: JSON 解析失败: %v", ErrInvalidSession, err)
	}
	if err := validateUpload(&req); err != nil {
		return nil, err
	}

	session := &model.SimSession{
		ID:              strings.TrimSpace(req.ID),
		UserID:          userID,
		ScenarioID:      strings.TrimSpace(req.ScenarioID),
		ScenarioTitle:   strings.TrimSpace(req.ScenarioTitle),
		ScenarioVersion: strings.TrimSpace(req.ScenarioVersion),
		Domain:          strings.TrimSpace(req.Domain),
		Score:           req.Score,
		Grade:           strings.TrimSpace(req.Grade),
		GradeLabel:      strings.TrimSpace(req.GradeLabel),
		OutcomeID:       strings.TrimSpace(req.Outcome.ID),
		OutcomeTitle:    strings.TrimSpace(req.Outcome.Title),
		DurationMs:      req.DurationMs,
		StartedAt:       time.UnixMilli(req.StartedAt),
		FinishedAt:      time.UnixMilli(req.FinishedAt),
		Payload:         append([]byte(nil), raw...),
		ReceivedAt:      time.Now(),
	}

	if _, err := s.repo.Upsert(session); err != nil {
		if errors.Is(err, repository.ErrSessionOwnedByAnotherUser) {
			return nil, ErrSessionConflict
		}
		return nil, err
	}

	return &dto.UploadResponse{
		ID:         session.ID,
		ReceivedAt: session.ReceivedAt.UnixMilli(),
	}, nil
}

func validateUpload(req *dto.SessionUploadRequest) error {
	if strings.TrimSpace(req.ID) == "" || len(req.ID) > 64 {
		return fmt.Errorf("%w: id 不能为空且不能超过 64 字符", ErrInvalidSession)
	}
	if strings.TrimSpace(req.ScenarioID) == "" || len(req.ScenarioID) > 64 {
		return fmt.Errorf("%w: scenarioId 不能为空且不能超过 64 字符", ErrInvalidSession)
	}
	if req.StartedAt <= 0 || req.FinishedAt <= 0 {
		return fmt.Errorf("%w: startedAt / finishedAt 必须是毫秒时间戳", ErrInvalidSession)
	}
	if req.FinishedAt < req.StartedAt {
		return fmt.Errorf("%w: finishedAt 不能早于 startedAt", ErrInvalidSession)
	}
	if req.DurationMs < 0 {
		return fmt.Errorf("%w: durationMs 不能为负数", ErrInvalidSession)
	}
	if req.Score < 0 || req.Score > 1000 {
		return fmt.Errorf("%w: score 超出允许范围", ErrInvalidSession)
	}
	switch strings.TrimSpace(req.Grade) {
	case "A", "B", "C", "D":
	default:
		return fmt.Errorf("%w: grade 必须是 A/B/C/D", ErrInvalidSession)
	}
	return nil
}

func (s *SessionService) GetByID(scope repository.Scope, id string) (*dto.SessionDetail, error) {
	row, err := s.repo.FindByID(scope, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &dto.SessionDetail{
		SessionItem: toSessionItem(row),
		Payload:     row.Payload,
	}, nil
}

func (s *SessionService) List(scope repository.Scope, query *dto.SessionListQuery) (*dto.SessionListResponse, error) {
	filter, err := ToFilter(query)
	if err != nil {
		return nil, err
	}
	rows, total, err := s.repo.List(scope, filter)
	if err != nil {
		return nil, err
	}
	items := make([]dto.SessionItem, 0, len(rows))
	for i := range rows {
		items = append(items, toSessionItem(&rows[i]))
	}
	return &dto.SessionListResponse{
		Items:    items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func toSessionItem(row *repository.SessionRow) dto.SessionItem {
	return dto.SessionItem{
		ID:              row.ID,
		UserID:          row.UserID,
		Username:        row.Username,
		Nickname:        row.Nickname,
		ClassID:         row.ClassID,
		ClassName:       row.ClassName,
		ScenarioID:      row.ScenarioID,
		ScenarioTitle:   row.ScenarioTitle,
		ScenarioVersion: row.ScenarioVersion,
		Domain:          row.Domain,
		Score:           row.Score,
		Grade:           row.Grade,
		GradeLabel:      row.GradeLabel,
		OutcomeID:       row.OutcomeID,
		OutcomeTitle:    row.OutcomeTitle,
		DurationMs:      row.DurationMs,
		StartedAt:       row.StartedAt.UnixMilli(),
		FinishedAt:      row.FinishedAt.UnixMilli(),
		ReceivedAt:      row.ReceivedAt.UnixMilli(),
	}
}
