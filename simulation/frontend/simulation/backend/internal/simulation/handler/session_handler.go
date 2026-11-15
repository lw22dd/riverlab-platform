package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"webGL-720yun/internal/core/middleware"
	"webGL-720yun/internal/simulation/dto"
	"webGL-720yun/internal/simulation/repository"
	"webGL-720yun/internal/simulation/service"
	"webGL-720yun/pkg/utils"

	"github.com/gin-gonic/gin"
)

func Submit(svc *service.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _, _ := middleware.GetCurrentUser(c)

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
		raw, err := io.ReadAll(c.Request.Body)
		if err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				utils.BadRequest(c, "会话数据超过 2MiB 限制")
				return
			}
			utils.BadRequest(c, "读取请求体失败")
			return
		}

		resp, err := svc.Submit(userID, raw)
		if err != nil {
			writeSessionError(c, err)
			return
		}
		utils.Success(c, resp)
	}
}

func GetSessionByID(svc *service.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _, role := middleware.GetCurrentUser(c)
		scope, err := svc.Scope(userID, role, middleware.GetIsAdmin(c))
		if err != nil {
			utils.InternalServerError(c, "构建数据范围失败")
			return
		}

		detail, err := svc.GetByID(scope, c.Param("id"))
		if err != nil {
			writeSessionError(c, err)
			return
		}
		utils.Success(c, detail)
	}
}

func ListSessions(svc *service.SessionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _, role := middleware.GetCurrentUser(c)
		scope, err := svc.Scope(userID, role, middleware.GetIsAdmin(c))
		if err != nil {
			utils.InternalServerError(c, "构建数据范围失败")
			return
		}

		var req dto.SessionListQuery
		if err := c.ShouldBindQuery(&req); err != nil {
			utils.BadRequest(c, "查询参数错误")
			return
		}

		resp, err := svc.List(scope, &req)
		if err != nil {
			utils.BadRequest(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func AnalyticsOverview(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, filter, ok := analyticsScope(c, svc, 0)
		if !ok {
			return
		}
		resp, err := svc.Overview(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func AnalyticsScenarios(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, filter, ok := analyticsScope(c, svc, 0)
		if !ok {
			return
		}
		resp, err := svc.Scenarios(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func AnalyticsDecisions(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, filter, ok := analyticsScope(c, svc, 0)
		if !ok {
			return
		}
		resp, err := svc.Decisions(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func AnalyticsRules(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, filter, ok := analyticsScope(c, svc, 0)
		if !ok {
			return
		}
		resp, err := svc.Rules(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func AnalyticsClasses(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		classID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || classID == 0 {
			utils.BadRequest(c, "班级 ID 不合法")
			return
		}

		scope, filter, ok := analyticsScope(c, svc, uint(classID))
		if !ok {
			return
		}
		resp, err := svc.Overview(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		utils.Success(c, resp)
	}
}

func ExportCSV(svc *service.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, filter, ok := analyticsScope(c, svc, 0)
		if !ok {
			return
		}
		data, err := svc.ExportCSV(scope, filter)
		if err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", `attachment; filename="sim-sessions.csv"`)
		c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
	}
}

func analyticsScope(c *gin.Context, svc *service.AnalyticsService, classID uint) (repository.Scope, repository.Filter, bool) {
	userID, _, role := middleware.GetCurrentUser(c)
	scope, err := svc.Scope(userID, role, middleware.GetIsAdmin(c))
	if err != nil {
		utils.InternalServerError(c, "构建数据范围失败")
		return scope, repository.Filter{}, false
	}

	var req dto.SessionListQuery
	if err := c.ShouldBindQuery(&req); err != nil {
		utils.BadRequest(c, "查询参数错误")
		return scope, repository.Filter{}, false
	}
	if classID > 0 {
		req.ClassID = classID
	}
	filter, err := service.ToFilter(&req)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return scope, repository.Filter{}, false
	}
	return scope, filter, true
}

func writeSessionError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrSessionConflict):
		utils.Error(c, http.StatusConflict, err.Error())
	case errors.Is(err, service.ErrSessionNotFound):
		utils.NotFound(c, err.Error())
	case errors.Is(err, service.ErrSessionForbidden):
		utils.Forbidden(c, err.Error())
	case errors.Is(err, service.ErrInvalidSession):
		utils.BadRequest(c, err.Error())
	default:
		utils.InternalServerError(c, err.Error())
	}
}
