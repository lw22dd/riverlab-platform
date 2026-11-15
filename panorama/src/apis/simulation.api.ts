import type { Result } from "@/models/result.model";
import type {
    AnalyticsOverview,
    AnalyticsQuery,
    DecisionAnalyticsData,
    RuleAnalyticsData,
    ScenarioAnalyticsData,
    SessionListData,
    SessionListQuery,
    SimSessionDetail,
} from "@/models/simulation.model";
import Axios from "@/utils/axios";

export default class SimulationApi {
    /** 实验数据概览：会话、学生、均分、等级/结局分布、每日趋势。 */
    public static async getOverview(params?: AnalyticsQuery): Promise<Result<AnalyticsOverview>> {
        return await Axios.get('/sim/analytics/overview', { params });
    }

    /** 场景维度统计（仅按时间与班级过滤）。 */
    public static async getScenarios(params?: AnalyticsQuery): Promise<Result<ScenarioAnalyticsData>> {
        return await Axios.get('/sim/analytics/scenarios', { params });
    }

    /** 决策选项分布（按场景与班级过滤）。 */
    public static async getDecisions(params?: AnalyticsQuery): Promise<Result<DecisionAnalyticsData>> {
        return await Axios.get('/sim/analytics/decisions', { params });
    }

    /** 评分规则命中统计（按场景与班级过滤）。 */
    public static async getRules(params?: AnalyticsQuery): Promise<Result<RuleAnalyticsData>> {
        return await Axios.get('/sim/analytics/rules', { params });
    }

    /** 会话分页列表。 */
    public static async getSessions(params?: SessionListQuery): Promise<Result<SessionListData>> {
        return await Axios.get('/sim/sessions', { params });
    }

    /** 单次实验详情，包含完整 payload 快照。 */
    public static async getSessionDetail(id: string): Promise<Result<SimSessionDetail>> {
        return await Axios.get(`/sim/sessions/${id}`);
    }

    /**
     * 导出实验会话 CSV。
     * 响应拦截器对 Blob 会直接返回，因此这里透传为 Blob。
     */
    public static async exportCsv(params?: AnalyticsQuery): Promise<Blob> {
        return (await Axios.get('/sim/analytics/export.csv', {
            params,
            responseType: 'blob',
        })) as unknown as Blob;
    }
}
