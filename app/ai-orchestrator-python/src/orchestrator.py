import json
import os
import re
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4()}"


def env(name, default=""):
    return os.environ.get(name, default)


CONFIG = {
    "host": env("ORCHESTRATOR_HOST", "0.0.0.0"),
    "port": int(env("ORCHESTRATOR_PORT", "8790")),
    "data_dir": Path(env("DATA_DIR", "./ai-orchestrator-python/data")),
    "ai_runtime": env("AI_RUNTIME", "dev").strip().lower(),
    "openai_base_url": env("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1").rstrip("/"),
    "openai_api_mode": env("OPENAI_API_MODE", "chat_completions"),
    "openai_api_key": env("OPENAI_API_KEY", ""),
    "openai_model": env("OPENAI_MODEL", "qwen-plus"),
    "openai_timeout": int(env("OPENAI_TIMEOUT_MS", "45000")) / 1000,
    "openai_max_retries": int(env("OPENAI_MAX_RETRIES", "1")),
}


class JsonStore:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.file = self.data_dir / "store.json"
        self.data = None

    def init(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if self.file.exists():
            self.data = json.loads(self.file.read_text("utf-8"))
            self.ensure_shape()
        else:
            self.data = self.empty_store()
            self.seed()
        if not self.data["agents"]:
            self.seed()
        self.save()

    def empty_store(self):
        return {
            "meta": {
                "schema_version": 10,
                "created_at": now_iso(),
                "runtime_architecture": "java-api-gateway-python-ai-orchestrator",
            },
            "agents": [],
            "agent_versions": [],
            "task_profiles": [],
            "sessions": [],
            "trace_events": [],
            "artifacts": [],
            "share_records": [],
            "policy_decisions": [],
        }

    def ensure_shape(self):
        blank = self.empty_store()
        for key, value in blank.items():
            self.data.setdefault(key, value)
        self.data["meta"].setdefault("schema_version", 10)
        self.data["meta"]["runtime_architecture"] = "java-api-gateway-python-ai-orchestrator"

    def seed(self):
        self.data["agents"] = [with_created(agent) for agent in seed_agents()]
        self.data["agent_versions"] = [create_agent_version(agent) for agent in self.data["agents"]]

    def save(self):
        self.file.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), "utf-8")

    def list(self, collection):
        return self.data.get(collection, [])

    def get(self, collection, field, value):
        return next((item for item in self.list(collection) if item.get(field) == value), None)

    def insert(self, collection, item):
        row = dict(item)
        row.setdefault("created_at", now_iso())
        self.data[collection].append(row)
        self.save()
        return row

    def update(self, collection, field, value, patch):
        rows = self.list(collection)
        for index, row in enumerate(rows):
            if row.get(field) == value:
                rows[index] = {**row, **patch, "updated_at": now_iso()}
                self.save()
                return rows[index]
        return None


def with_created(agent):
    return {**agent, "created_at": now_iso(), "created_by": agent.get("created_by", "system")}


def seed_agents():
    base = [
        agent(
            "agent-product-manager",
            "Product Manager",
            "判断产品价值、目标用户、优先级、MVP 边界和落地指标。",
            ["产品价值", "用户目标", "需求优先级", "MVP 范围", "商业目标"],
            ["产品规划", "复杂问题拆解", "需求取舍"],
        ),
        agent(
            "agent-ux-researcher",
            "UX Researcher",
            "从真实使用者行为、任务路径、可用性和反馈闭环评估方案。",
            ["用户研究", "使用路径", "可用性", "用户反馈", "信息架构"],
            ["体验评估", "流程诊断", "新产品验证"],
        ),
        agent(
            "agent-instructional-designer",
            "Instructional Design Expert",
            "把教学目标、学习任务、课堂活动、练习反馈和教师工作流转成可执行方案。",
            ["教学设计", "课程设计", "学习任务", "课堂活动", "教师工作流"],
            ["教育", "英语教学", "学校教学改革", "教师备课"],
        ),
        agent(
            "agent-learning-assessment",
            "Learning Assessment Specialist",
            "评估学习效果、测评方式、形成性评价、作业反馈和学生能力提升证据。",
            ["学习评估", "形成性评价", "测评设计", "学习效果", "作业反馈"],
            ["教育", "英语学习", "学校评价体系", "论文方案"],
        ),
        agent(
            "agent-school-deployment-advisor",
            "School Deployment Advisor",
            "审视学校组织约束、教师能力、软硬件条件、课堂落地和管理接受度。",
            ["学校落地", "教师培训", "软硬件条件", "教学管理", "试点推广"],
            ["教育", "学校场景", "初中", "高中", "课堂试点"],
        ),
        agent(
            "agent-healthcare-compliance",
            "Healthcare Compliance Specialist",
            "审视医疗健康产品的数据、宣传、用户授权、监管和合规边界。",
            ["医疗合规", "健康数据", "用户授权", "宣传边界", "监管风险"],
            ["医疗", "健康产品", "合规评审"],
        ),
        agent(
            "agent-financial-auditor",
            "Financial Audit Analyst",
            "审视财务口径、成本收益、审计证据、预算约束和投入产出。",
            ["财务审计", "成本收益", "预算", "投入产出", "审计证据"],
            ["财务", "部门预算", "商业方案", "上线评审"],
        ),
        agent(
            "agent-business-strategist",
            "Business Strategist",
            "判断业务动机、决策链、收益闭环、反对力量和推进路径。",
            ["业务闭环", "决策链", "收益", "反对力量", "推进路径"],
            ["业务方案", "部门工具", "产品规划", "客户方案"],
        ),
        agent(
            "agent-workflow-architect",
            "Workflow Architect",
            "把复杂任务拆成状态机、阶段门禁、可追踪事件和失败恢复流程。",
            ["工作流", "状态机", "阶段门禁", "异常处理", "追溯"],
            ["工作流设计", "协作工具", "复杂任务编排"],
        ),
        agent(
            "agent-multi-agent-architect",
            "Multi-Agent Systems Architect",
            "设计多 Agent 拓扑、上下文隔离、质疑机制、失败恢复和可观测性。",
            ["多 Agent 编排", "质疑机制", "上下文治理", "失败恢复", "可观测性"],
            ["AI 工作流", "Agent 产品", "圆桌讨论"],
        ),
        agent(
            "agent-software-architect",
            "Software Architect",
            "设计服务边界、API、数据模型、部署结构和技术演进路径。",
            ["技术架构", "API", "数据模型", "部署", "服务边界"],
            ["软件架构", "云部署", "前后端分离", "微服务"],
        ),
        agent(
            "agent-ai-engineer",
            "AI Engineer",
            "负责模型调用、结构化输出、提示词契约、质量评估和生产级 AI 集成。",
            ["AI 编排", "模型调用", "结构化输出", "质量评估", "LLM 集成"],
            ["AI 产品", "模型接入", "智能体编排"],
        ),
        agent(
            "agent-security-architect",
            "Security Architect",
            "识别权限、密钥、网络暴露、工具调用和部署安全风险。",
            ["安全架构", "权限", "密钥管理", "网络暴露", "部署安全"],
            ["云部署", "部门工具", "API 安全"],
        ),
        agent(
            "agent-data-privacy-officer",
            "Data Privacy Officer",
            "审视个人信息、用户材料、共享边界、数据最小化和删除导出。",
            ["数据隐私", "个人信息", "数据最小化", "共享边界", "授权"],
            ["教育", "医疗", "部门协作", "隐私评审"],
        ),
        agent(
            "agent-reality-checker",
            "Reality Checker",
            "专门质疑方案是否只是演示、是否缺少证据、是否具备真实生产力。",
            ["现实校验", "证据要求", "生产可用性", "反演失败", "质量门禁"],
            ["产品验收", "上线评审", "方案复盘"],
        ),
    ]
    return base


def agent(agent_id, name, summary, capabilities, scenarios):
    return {
        "agent_id": agent_id,
        "display_name": name,
        "summary": summary,
        "agent_class": "system_public",
        "owner_user_id": None,
        "trust_status": "official_verified",
        "visibility_scope": "all_users",
        "publish_status": "published",
        "default_pool_eligible": True,
        "current_version_id": f"{agent_id}:v1",
        "capabilities": capabilities,
        "responsibilities": [summary],
        "applicable_scenarios": scenarios,
        "boundaries": ["只在自身专业边界内给出判断", "重要结论必须标注证据或待确认前提"],
        "forbidden_behaviors": ["不得伪造外部事实", "不得绕过权限读取材料", "不得把猜测写成确定结论"],
        "permissions": ["problem_only", "summary_only"],
        "input_policy": "默认读取问题、背景和任务画像摘要；不读取完整私密材料。",
        "output_schema": ["position", "challenge", "response", "revision", "evidence_gap"],
        "test_cases": ["能说明适用场景", "能提出至少一个证据缺口", "能对其他 Agent 观点提出具体质疑"],
        "quality_status": "baseline_verified",
        "source_type": "system_seed",
    }


def create_agent_version(agent):
    return {
        "agent_version_id": agent["current_version_id"],
        "agent_id": agent["agent_id"],
        "version_label": "v1",
        "content_hash": f"{agent['agent_id']}:java-python-seed",
        "source_hash": "java-python-seed",
        "source_type": agent.get("source_type", "system_seed"),
        "instructions_snapshot": agent["summary"],
        "metadata_snapshot": {
            "capabilities": agent.get("capabilities", []),
            "boundaries": agent.get("boundaries", []),
            "responsibilities": agent.get("responsibilities", []),
            "applicable_scenarios": agent.get("applicable_scenarios", []),
            "quality_status": agent.get("quality_status"),
        },
        "release_status": "active",
        "created_at": now_iso(),
    }


class OpenAIClient:
    def __init__(self, config):
        self.config = config

    def configured(self):
        return self.config["ai_runtime"] == "openai" and bool(self.config["openai_api_key"])

    def call_json(self, schema_name, instructions, payload, temperature=0.2):
        if not self.configured():
            return None, self.evidence(schema_name, "dev_degraded_no_api_key", 0)

        started = time.time()
        last_error = None
        for attempt in range(self.config["openai_max_retries"] + 1):
            try:
                body, url = self.build_body(schema_name, instructions, payload, temperature, attempt)
                request = urllib.request.Request(
                    url,
                    data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.config['openai_api_key']}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=self.config["openai_timeout"]) as response:
                    raw = response.read().decode("utf-8")
                parsed = json.loads(raw)
                output = normalize_provider_json(parsed, self.config["openai_api_mode"])
                return output, self.evidence(schema_name, "applied", int((time.time() - started) * 1000))
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt < self.config["openai_max_retries"]:
                    time.sleep(min(0.5 * (2 ** attempt), 2.0))
        detail = str(last_error)[:500] if last_error else "unknown"
        return None, self.evidence(schema_name, "fallback_dev_after_error", int((time.time() - started) * 1000), detail)

    def build_body(self, schema_name, instructions, payload, temperature, attempt):
        if self.config["openai_api_mode"] == "chat_completions":
            return {
                "model": self.config["openai_model"],
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{instructions}\n\n"
                            f"你必须只输出 JSON，不要输出 Markdown。schema_name={schema_name}，attempt={attempt + 1}"
                        ),
                    },
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens_for_schema(schema_name),
                "response_format": {"type": "json_object"},
            }, f"{self.config['openai_base_url']}/chat/completions"

        return {
            "model": self.config["openai_model"],
            "instructions": instructions,
            "input": json.dumps(payload, ensure_ascii=False),
            "metadata": {"schema_name": schema_name, "attempt": str(attempt + 1)},
        }, f"{self.config['openai_base_url']}/responses"

    def evidence(self, schema_name, status, latency_ms, error=None):
        item = {
            "schema_name": schema_name,
            "runtime_mode": runtime_mode(),
            "status": status,
            "model": self.config["openai_model"] if self.configured() else "none",
            "provider_mode": self.config["openai_api_mode"],
            "latency_ms": latency_ms,
            "recorded_at": now_iso(),
        }
        if error:
            item["error"] = error
        return item


def normalize_provider_json(data, mode):
    if mode == "chat_completions":
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return parse_json_object(content)
    if isinstance(data.get("output_json"), dict):
        return data["output_json"]
    text_parts = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in ("output_text", "text"):
                text_parts.append(content.get("text", ""))
    return parse_json_object("\n".join(text_parts))


def parse_json_object(text):
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def max_tokens_for_schema(schema_name):
    limits = {
        "task_profile_agent": 900,
        "agent_selector_agent": 900,
        "agent_position_event": 500,
        "critic_agent": 420,
        "agent_response_revision": 500,
        "consensus_synthesizer": 700,
        "report_synthesizer": 1600,
    }
    return limits.get(schema_name, 800)


def runtime_mode():
    if CONFIG["ai_runtime"] == "openai" and CONFIG["openai_api_key"]:
        return "openai"
    if CONFIG["ai_runtime"] == "openai":
        return "dev_degraded_missing_key"
    return "dev"


def create_task_profile(input_body, store, client):
    problem = required_text(input_body.get("problem"), "problem")
    background = str(input_body.get("background") or "")
    target_output = str(input_body.get("targetOutput") or "评审报告")
    baseline = heuristic_profile(problem, background, target_output)
    evidence = []

    model_output, call_evidence = client.call_json(
        "task_profile_agent",
        (
            "你是任务画像分析器。你要真实理解用户问题，不允许只按关键词套模板。"
            "输出 JSON 字段：task_type, industry, user_goal, decision_type, target_output, risk_level, "
            "required_perspectives, missing_information, clarifying_questions, evidence_needs, assumptions, constraints。"
            "required_perspectives 必须是面向真实专业分工的中文短标签。"
        ),
        {"problem": problem, "background": background, "target_output": target_output, "baseline": baseline},
    )
    evidence.append(call_evidence)

    enriched = merge_profile(baseline, model_output or {})
    profile = {
        "task_profile_id": new_id("task"),
        "original_problem": problem,
        "background": background,
        "target_output": enriched.get("target_output") or target_output,
        "task_type": enriched["task_type"],
        "industry": enriched["industry"],
        "user_goal": enriched["user_goal"],
        "decision_type": enriched["decision_type"],
        "risk_level": enriched["risk_level"],
        "required_perspectives": enriched["required_perspectives"],
        "missing_information": enriched["missing_information"],
        "clarifying_questions": enriched["clarifying_questions"],
        "evidence_needs": enriched["evidence_needs"],
        "assumptions": enriched["assumptions"],
        "constraints": enriched["constraints"],
        "runtime_mode": runtime_mode(),
        "runtime_evidence": evidence,
        "created_at": now_iso(),
    }
    return store.insert("task_profiles", profile)


def heuristic_profile(problem, background, target_output):
    text = f"{problem}\n{background}".lower()
    if has_any(text, ["英语", "教学", "学校", "初中", "高中", "教育", "课堂", "学生", "教师"]):
        return {
            "task_type": "教育场景方案审议",
            "industry": "教育",
            "user_goal": "判断 AI 如何在真实教学场景中产生可落地价值",
            "decision_type": "方案设计与落地评审",
            "target_output": target_output,
            "risk_level": "high" if has_any(text, ["未成年人", "隐私", "学校"]) else "medium",
            "required_perspectives": ["教育行业专家", "教学设计", "学习评估", "学校落地", "数据隐私", "产品价值"],
            "missing_information": ["学校类型和年级", "现有软硬件条件", "教师 AI 使用能力", "评价指标"],
            "clarifying_questions": ["目标是提升成绩、减负、个性化学习，还是形成论文方案？"],
            "evidence_needs": ["教学目标", "课堂流程", "学习效果指标", "数据授权边界"],
            "assumptions": ["用户需要的是可落地方案，而不是泛泛 AI 应用清单"],
            "constraints": ["不能把未验证教学效果写成确定收益"],
        }
    if has_any(text, ["医疗", "健康", "患者", "医院", "药"]):
        return {
            "task_type": "医疗健康上线评审",
            "industry": "医疗健康",
            "user_goal": "判断产品上线前的价值、合规、风险和运营准备度",
            "decision_type": "上线评审",
            "target_output": target_output,
            "risk_level": "high",
            "required_perspectives": ["医疗行业专家", "合规审查", "数据隐私", "产品价值", "财务审计", "运营落地"],
            "missing_information": ["目标用户", "处理的数据类型", "宣传用语", "授权流程"],
            "clarifying_questions": ["是否涉及诊断、治疗建议或健康数据处理？"],
            "evidence_needs": ["监管边界", "用户授权记录", "宣传材料", "成本收益假设"],
            "assumptions": ["医疗健康场景默认按高风险处理"],
            "constraints": ["不得输出替代正式医疗或法律意见的结论"],
        }
    if has_any(text, ["部署", "架构", "微服务", "容器", "api", "上线"]):
        return {
            "task_type": "技术产品上线审议",
            "industry": "软件/AI 工具",
            "user_goal": "判断技术架构能否支撑真实可用的产品体验",
            "decision_type": "架构与上线评审",
            "target_output": target_output,
            "risk_level": "high",
            "required_perspectives": ["产品价值", "技术架构", "AI 编排", "安全架构", "数据隐私", "现实校验"],
            "missing_information": ["并发规模", "用户权限", "模型供应商", "质量验收标准"],
            "clarifying_questions": ["首期是否必须支持部门多用户和审计？"],
            "evidence_needs": ["真实模型调用记录", "部署拓扑", "质量验收样例", "密钥管理方式"],
            "assumptions": ["首期优先保证真实生产力，而不是演示流程"],
            "constraints": ["线上默认不得使用伪装成真实结果的模拟运行时"],
        }
    return {
        "task_type": "复杂问题审议",
        "industry": "通用",
        "user_goal": "形成可执行、可质疑、可追溯的高质量回答",
        "decision_type": "方案评审",
        "target_output": target_output,
        "risk_level": "medium",
        "required_perspectives": ["产品价值", "业务闭环", "现实校验", "数据隐私", "技术架构"],
        "missing_information": ["目标受众", "使用场景", "约束条件", "成功标准"],
        "clarifying_questions": ["最终产物要用于决策、汇报、执行，还是研究？"],
        "evidence_needs": ["目标定义", "约束条件", "可验证指标", "风险边界"],
        "assumptions": ["用户希望系统自动判断所需专家"],
        "constraints": ["不能用模板化圆桌替代真实审议"],
    }


def merge_profile(base, incoming):
    result = dict(base)
    for key in ["task_type", "industry", "user_goal", "decision_type", "target_output", "risk_level"]:
        if incoming.get(key):
            result[key] = str(incoming[key])
    for key in ["required_perspectives", "missing_information", "clarifying_questions", "evidence_needs", "assumptions", "constraints"]:
        result[key] = merge_list(result.get(key, []), incoming.get(key, []))
    return result


def merge_list(base, incoming):
    values = []
    for item in (base if isinstance(base, list) else []):
        if item and str(item) not in values:
            values.append(str(item))
    for item in (incoming if isinstance(incoming, list) else []):
        if item and str(item) not in values:
            values.append(str(item))
    return values


def recommend_agents(profile, store, client):
    visible_agents = [item for item in store.list("agents") if is_visible(item)]
    started = time.time()
    scored = sorted(
        [{"agent": agent, "score": score_agent(agent, profile)} for agent in visible_agents],
        key=lambda item: item["score"],
        reverse=True,
    )
    selected = fallback_select(scored, profile)
    selected_ids = [item["agent"]["agent_id"] for item in selected]
    excluded_notes = []
    evidence = []

    model_output, call_evidence = client.call_json(
        "agent_selector_agent",
        (
            "你是 Agent 阵容选择器。你必须基于任务画像和候选 Agent 元数据选择真实需要的专家。"
            "输出 JSON：{panel_summary, selected_agent_ids, excluded_agents:[{agent_id,reason}], "
            "missing_perspectives, selection_notes}。只能选择候选中存在的 agent_id。"
        ),
        {
            "task_profile": profile,
            "candidate_agents": [candidate_summary(item["agent"], item["score"]) for item in scored[:14]],
        },
    )
    evidence.append(call_evidence)

    if model_output:
        valid_ids = {agent["agent_id"] for agent in visible_agents}
        model_ids = [item for item in model_output.get("selected_agent_ids", []) if item in valid_ids]
        if model_ids:
            selected = [{"agent": store.get("agents", "agent_id", agent_id), "score": score_agent(store.get("agents", "agent_id", agent_id), profile)} for agent_id in model_ids]
            selected_ids = model_ids
        excluded_notes = model_output.get("excluded_agents", []) if isinstance(model_output.get("excluded_agents"), list) else []

    missing = missing_perspectives(profile, [item["agent"] for item in selected])
    if model_output and isinstance(model_output.get("missing_perspectives"), list):
        missing = merge_list(missing, model_output["missing_perspectives"])

    generated = [ensure_personal_agent(perspective, profile, store) for perspective in missing]
    selected_agents = cap_panel_agents([item["agent"] for item in selected], profile)
    generated_agents = generated[: max(0, panel_limit() - len(selected_agents))]
    final_panel = selected_agents + generated_agents
    recommended = [recommendation_entry(agent, profile, "matched_existing") for agent in selected_agents]
    recommended += [recommendation_entry(agent, profile, "auto_generated_personal") for agent in generated_agents]

    excluded = build_excluded(scored, selected_ids, excluded_notes)
    coverage = [
        {
            "perspective": perspective,
            "status": "covered" if any(covers(agent, perspective) for agent in final_panel) else "weak",
        }
        for perspective in profile["required_perspectives"]
    ]
    for item in coverage:
        if any(agent.get("generated_for_perspective") == item["perspective"] for agent in generated):
            item["status"] = "auto_filled"

    trace = [
        trace_step("task_profile_agent", "真实分析任务画像", f"识别行业={profile['industry']}，决策类型={profile['decision_type']}，必要视角 {len(profile['required_perspectives'])} 个。", profile["runtime_evidence"][0]),
        trace_step("candidate_search", "检索真实 Agent 候选", f"检索基础公共、个人和共享 Agent，共 {len(visible_agents)} 个候选。", duration_ms=1, status="done"),
        trace_step("agent_selector_agent", "模型审查专家阵容", model_output.get("panel_summary") if model_output else "未配置真实模型，使用透明开发降级选择；此结果不得作为生产质量验收。", call_evidence),
    ]
    if generated:
        trace.append(trace_step("agent_generator_agent", "自动补齐个人试用 Agent", f"生成 {len(generated)} 个个人试用 Agent：{', '.join([item['display_name'] for item in generated])}。", duration_ms=1, status="done"))
    trace.append(trace_step("panel_ready", "形成可运行圆桌阵容", f"最终阵容 {len(recommended)} 个 Agent，耗时 {int((time.time() - started) * 1000)}ms。", duration_ms=int((time.time() - started) * 1000), status="done"))

    return {
        "recommendation_id": new_id("rec"),
        "recommended_agents": recommended,
        "excluded_agents": excluded,
        "coverage": coverage,
        "missing_perspectives": missing,
        "generated_agents": [
            {
                "mode": "created_personal_draft",
                "perspective": agent.get("generated_for_perspective") or first_covered_perspective(agent, profile),
                "agent_id": agent["agent_id"],
                "display_name": agent["display_name"],
                "agent_class": agent["agent_class"],
                "trust_status": agent["trust_status"],
                "reason": agent["summary"],
            }
            for agent in generated_agents
        ],
        "ai_review": {
            "status": call_evidence["status"],
            "runtime_mode": runtime_mode(),
            "panel_summary": model_output.get("panel_summary") if model_output else "开发降级阵容，仅用于联调。",
            "selection_notes": model_output.get("selection_notes", []) if model_output else ["缺少真实 API Key，不能视为生产级组建结果。"],
        },
        "runtime_evidence": evidence,
        "assembly_trace": trace,
        "created_at": now_iso(),
    }


def trace_step(stage, title, detail, evidence=None, duration_ms=None, status=None):
    return {
        "stage": stage,
        "title": title,
        "detail": detail,
        "status": status or (evidence.get("status") if evidence else "done"),
        "runtime_mode": evidence.get("runtime_mode") if evidence else runtime_mode(),
        "model": evidence.get("model") if evidence else None,
        "duration_ms": duration_ms if duration_ms is not None else evidence.get("latency_ms", 0) if evidence else 0,
        "created_at": now_iso(),
    }


def panel_limit():
    return 4 if runtime_mode() == "openai" else 6


def cap_panel_agents(agents, profile, limit=None):
    limit = limit or panel_limit()
    if len(agents) <= limit:
        return agents
    picked = []
    for perspective in profile.get("required_perspectives", []):
        match = next((agent for agent in agents if agent not in picked and covers(agent, perspective)), None)
        if match:
            picked.append(match)
        if len(picked) >= limit:
            return picked
    for agent in agents:
        if agent not in picked:
            picked.append(agent)
        if len(picked) >= limit:
            break
    return picked


def candidate_summary(agent, score):
    return {
        "agent_id": agent["agent_id"],
        "display_name": agent["display_name"],
        "summary": agent["summary"],
        "capabilities": agent.get("capabilities", []),
        "applicable_scenarios": agent.get("applicable_scenarios", []),
        "trust_status": agent.get("trust_status"),
        "agent_class": agent.get("agent_class"),
        "score": score,
    }


def is_visible(agent):
    return agent.get("visibility_scope") == "all_users" or agent.get("owner_user_id") == "local-user"


def score_agent(agent, profile):
    text = agent_text(agent)
    score = 0
    for perspective in profile.get("required_perspectives", []):
        if covers(agent, perspective):
            score += 10
        for token in tokenize(perspective):
            if token and token in text:
                score += 2
    for token in tokenize(profile.get("industry", "")):
        if token in text:
            score += 4
    if agent.get("trust_status") == "official_verified":
        score += 2
    return score


def fallback_select(scored, profile):
    selected = []
    for perspective in profile.get("required_perspectives", []):
        best = next((item for item in scored if item not in selected and covers(item["agent"], perspective)), None)
        if best:
            selected.append(best)
    for item in scored:
        if len(selected) >= 7:
            break
        if item["score"] <= 1:
            continue
        if item not in selected:
            selected.append(item)
    return selected


def missing_perspectives(profile, agents):
    return [perspective for perspective in profile.get("required_perspectives", []) if not any(covers(agent, perspective) for agent in agents)]


def covers(agent, perspective):
    text = agent_text(agent)
    perspective = str(perspective)
    synonyms = {
        "教育行业专家": ["教育", "学校", "教学", "课堂"],
        "教学设计": ["教学设计", "课程设计", "课堂活动"],
        "学习评估": ["学习评估", "测评", "形成性评价"],
        "学校落地": ["学校落地", "教师培训", "软硬件条件"],
        "数据隐私": ["数据隐私", "个人信息", "数据最小化", "授权"],
        "产品价值": ["产品", "用户目标", "需求优先级", "商业目标"],
        "医疗行业专家": ["医疗", "健康", "患者"],
        "合规审查": ["合规", "监管", "宣传边界"],
        "财务审计": ["财务", "审计", "成本收益", "预算"],
        "技术架构": ["技术架构", "API", "部署", "微服务"],
        "AI 编排": ["AI", "模型调用", "结构化输出", "LLM"],
        "安全架构": ["安全", "权限", "密钥", "网络暴露"],
        "现实校验": ["现实校验", "生产可用性", "证据要求"],
    }
    terms = [perspective] + synonyms.get(perspective, []) + tokenize(perspective)
    return any(term and term.lower() in text for term in terms)


def first_covered_perspective(agent, profile):
    for perspective in profile.get("required_perspectives", []):
        if covers(agent, perspective):
            return perspective
    return agent.get("generated_for_perspective") or "补位视角"


def agent_text(agent):
    fields = [
        agent.get("display_name", ""),
        agent.get("summary", ""),
        " ".join(agent.get("capabilities", [])),
        " ".join(agent.get("applicable_scenarios", [])),
        " ".join(agent.get("responsibilities", [])),
    ]
    return " ".join(fields).lower()


def tokenize(value):
    return [item for item in re.split(r"[\s,，/、;；:：]+", str(value).lower()) if len(item) >= 2]


def ensure_personal_agent(perspective, profile, store):
    existing = next(
        (
            agent
            for agent in store.list("agents")
            if agent.get("owner_user_id") == "local-user"
            and agent.get("source_type") == "auto_generated_for_task"
            and covers(agent, perspective)
        ),
        None,
    )
    if existing:
        return existing

    agent_id = new_id("agent")
    generated = {
        "agent_id": agent_id,
        "display_name": f"{perspective}个人试用 Agent",
        "summary": f"系统识别当前任务缺少 {perspective} 视角，自动生成个人试用 Agent，用于本次任务审议。",
        "agent_class": "personal_private",
        "owner_user_id": "local-user",
        "trust_status": "trial_only",
        "visibility_scope": "owner_only",
        "publish_status": "draft",
        "default_pool_eligible": False,
        "current_version_id": f"{agent_id}:v1",
        "capabilities": [perspective, "专项审议", "证据缺口识别", "风险边界"],
        "responsibilities": [f"补齐 {perspective} 视角，明确风险、证据缺口和可落地建议。"],
        "applicable_scenarios": [profile.get("industry", "通用"), profile.get("task_type", "复杂问题审议")],
        "boundaries": ["未验证前不得进入公共推荐池", "默认只读取问题和任务画像摘要"],
        "forbidden_behaviors": ["不得伪造权威事实", "不得越权访问材料"],
        "permissions": ["problem_only"],
        "input_policy": "只读取问题、背景摘要和任务画像。",
        "output_schema": ["position", "challenge", "response", "revision", "evidence_gap"],
        "test_cases": ["能说明为什么需要该视角", "能提出证据缺口"],
        "quality_status": "trial_unverified",
        "source_type": "auto_generated_for_task",
        "generated_for_perspective": perspective,
        "generated_for_task_profile_id": profile["task_profile_id"],
        "trigger_request": profile["original_problem"],
        "created_by": "system",
    }
    store.insert("agents", generated)
    store.insert("agent_versions", create_agent_version(generated))
    return generated


def recommendation_entry(agent, profile, source):
    covered = [perspective for perspective in profile.get("required_perspectives", []) if covers(agent, perspective)]
    return {
        "agent_id": agent["agent_id"],
        "agent_version_id": agent["current_version_id"],
        "display_name": agent["display_name"],
        "agent_class": agent["agent_class"],
        "trust_status": agent["trust_status"],
        "access_level": "summary_only" if "summary_only" in agent.get("permissions", []) else "problem_only",
        "score": score_agent(agent, profile),
        "role": infer_role(agent),
        "fit_reason": f"覆盖 {', '.join(covered) if covered else profile.get('industry', '通用')} 视角；边界：{'; '.join(agent.get('boundaries', [])[:2])}",
        "selection_source": source,
        "generated_for_task": agent.get("source_type") == "auto_generated_for_task",
        "covered_perspectives": covered,
        "quality_status": agent.get("quality_status"),
        "responsibilities": agent.get("responsibilities", []),
    }


def infer_role(agent):
    name = agent.get("display_name", "")
    if "Compliance" in name or "Privacy" in name or "Security" in name:
        return "风险与边界审查"
    if "Education" in name or "Instructional" in name or "Learning" in name or "School" in name:
        return "行业与落地审查"
    if "Architect" in name or "Engineer" in name:
        return "架构与可执行性审查"
    if "Reality" in name:
        return "现实可用性审查"
    return "专业审议"


def build_excluded(scored, selected_ids, excluded_notes):
    note_by_id = {
        item.get("agent_id"): item.get("reason")
        for item in excluded_notes
        if isinstance(item, dict) and item.get("agent_id")
    }
    excluded = []
    for item in scored:
        agent = item["agent"]
        if agent["agent_id"] in selected_ids:
            continue
        excluded.append(
            {
                "agent_id": agent["agent_id"],
                "display_name": agent["display_name"],
                "reason": note_by_id.get(agent["agent_id"], "当前阵容已覆盖主要视角，暂不加入以控制讨论复杂度。"),
            }
        )
        if len(excluded) >= 8:
            break
    return excluded


def create_session(body, store, client):
    profile = create_task_profile(body, store, client)
    recommendation = recommend_agents(profile, store, client)
    session = {
        "session_id": new_id("session"),
        "run_id": new_id("run"),
        "status": "draft",
        "current_stage": "agent_panel_recommended",
        "problem": profile["original_problem"],
        "background": profile["background"],
        "task_profile": profile,
        "agent_panel": recommendation["recommended_agents"],
        "recommendation": recommendation,
        "trace_event_ids": [],
        "artifact_ids": [],
        "runtime_mode": runtime_mode(),
        "created_at": now_iso(),
    }
    return store.insert("sessions", session)


def run_roundtable(session, store, client):
    if session.get("status") == "complete":
        events = [event for event in store.list("trace_events") if event.get("session_id") == session["session_id"]]
        artifacts = [artifact for artifact in store.list("artifacts") if artifact.get("session_id") == session["session_id"]]
        return {"session": session, "events": events, "artifact": artifacts[0] if artifacts else None, "alreadyComplete": True}

    agents = [store.get("agents", "agent_id", item["agent_id"]) for item in session.get("agent_panel", [])]
    agents = [agent for agent in agents if agent]
    agents = agents[:panel_limit()]
    events = []

    positions = [make_position(agent, session, client) for agent in agents]
    events.extend(positions)

    max_challenges = 2 if runtime_mode() == "openai" else 3
    challenge_targets = positions[: min(max_challenges, len(positions))]
    challenges = []
    for index, target in enumerate(challenge_targets):
        challenger = agents[(index + 1) % len(agents)] if agents else None
        if challenger:
            challenges.append(make_challenge(challenger, target, session, client))
    events.extend(challenges)

    responses = []
    for challenge in challenges:
        target = next((event for event in positions if event["event_id"] == challenge["payload"].get("target_event_id")), None)
        responder = next((agent for agent in agents if agent["agent_id"] == target.get("agent_id")), agents[0] if agents else None)
        if responder:
            responses.append(make_response(responder, challenge, target, session, client))
    events.extend(responses)

    revisions = [make_revision(event, session, client) for event in responses[:3]]
    events.extend(revisions)

    consensus = make_consensus(session, agents[0] if agents else None, events, client)
    gap = make_evidence_gap(session, agents[-1] if agents else None, events, client)
    events.extend([consensus, gap])

    saved_events = [store.insert("trace_events", event) for event in events]
    artifact = make_report(session, saved_events, store, client)
    saved_artifact = store.insert("artifacts", artifact)
    updated = store.update(
        "sessions",
        "session_id",
        session["session_id"],
        {
            "status": "complete",
            "current_stage": "final_artifact_generated",
            "trace_event_ids": [event["event_id"] for event in saved_events],
            "artifact_ids": [saved_artifact["artifact_id"]],
            "completed_at": now_iso(),
            "runtime_mode": runtime_mode(),
        },
    )
    return {"session": updated, "events": saved_events, "artifact": saved_artifact}


def make_position(agent, session, client):
    output, evidence = client.call_json(
        "agent_position_event",
        (
            "你是指定 Agent，必须基于自己的职责独立提出首轮立场。"
            "输出 JSON：{claim,rationale,assumptions,risks,evidence_refs,confidence_level,challenge_requested}。"
        ),
        {"agent": public_agent(agent), "task_profile": session["task_profile"], "problem": session["problem"], "background": session.get("background", "")},
    )
    payload = output if isinstance(output, dict) else dev_position_payload(agent, session)
    return make_event(session, agent, "position", payload, evidence)


def make_challenge(agent, target_event, session, client):
    output, evidence = client.call_json(
        "critic_agent",
        (
            "你是质疑 Agent。必须针对目标观点提出具体、可回应的质疑，不允许泛泛说需要更多信息。"
            "输出 JSON：{target_event_id,challenge_type,severity,challenge_text,required_response,evidence_refs}。"
        ),
        {"challenger": public_agent(agent), "target_event": target_event, "task_profile": session["task_profile"]},
    )
    payload = output if isinstance(output, dict) else {
        "target_event_id": target_event["event_id"],
        "challenge_type": "missing_evidence",
        "severity": "high",
        "challenge_text": f"{agent['display_name']} 认为该观点还缺少真实场景证据和可执行边界，不能直接进入共识。",
        "required_response": True,
        "evidence_refs": ["task_profile", "user_problem"],
    }
    payload["target_event_id"] = target_event["event_id"]
    return make_event(session, agent, "challenge", payload, evidence)


def make_response(agent, challenge, target, session, client):
    output, evidence = client.call_json(
        "agent_response_revision",
        (
            "你是被质疑 Agent。必须回应质疑，并说明接受、部分接受或拒绝。"
            "输出 JSON：{challenge_id,response_type,response_text,accepted_changes,remaining_disagreement,revised_claim}。"
        ),
        {"agent": public_agent(agent), "challenge": challenge, "target_position": target, "task_profile": session["task_profile"]},
    )
    payload = output if isinstance(output, dict) else {
        "challenge_id": challenge["event_id"],
        "response_type": "partially_accepted",
        "response_text": "接受质疑：将原观点降级为条件性建议，并补充需要验证的前提。",
        "accepted_changes": ["补充证据缺口", "降低确定性", "增加落地边界"],
        "remaining_disagreement": "仍需真实用户或业务负责人确认优先级。",
        "revised_claim": f"{agent['display_name']} 修正后认为：该建议必须先通过小范围试点或证据验证。",
    }
    payload["challenge_id"] = challenge["event_id"]
    return make_event(session, agent, "response", payload, evidence)


def make_revision(response_event, session, client):
    agent = {"agent_id": response_event["agent_id"], "display_name": response_event["agent_name"], "current_version_id": response_event["agent_version_id"]}
    payload = {
        "original_position_id": response_event["payload"].get("challenge_id"),
        "revised_claim": response_event["payload"].get("revised_claim") or response_event["payload"].get("response_text"),
        "revision_reason": "质疑回应后形成修正观点。",
        "impact_level": "high",
    }
    return make_event(session, agent, "revision", payload, response_event.get("runtime_evidence"))


def make_consensus(session, agent, events, client):
    output, evidence = client.call_json(
        "consensus_synthesizer",
        (
            "你是圆桌主持人。综合观点、质疑、回应和修正，输出 JSON："
            "{consensus_type,statement,supporting_event_ids,confidence_level,remaining_risks,disagreements,next_actions}。"
            "必须保留分歧和证据缺口。"
        ),
        {"task_profile": session["task_profile"], "events": events},
    )
    payload = output if isinstance(output, dict) else {
        "consensus_type": "conditional_consensus",
        "statement": f"本次圆桌形成条件性结论：围绕 {session['task_profile']['user_goal']}，应先明确证据、场景和边界，再进入正式实施。",
        "supporting_event_ids": [event["event_id"] for event in events if event["event_type"] in ["position", "response", "revision"]],
        "confidence_level": "medium",
        "remaining_risks": session["task_profile"].get("missing_information", []),
        "disagreements": ["部分观点仍缺少真实使用数据或业务负责人确认。"],
        "next_actions": ["补齐缺失信息", "进行小范围试点", "根据证据更新报告"],
    }
    return make_event(session, agent or system_agent(), "consensus", payload, evidence)


def make_evidence_gap(session, agent, events, client):
    missing = session["task_profile"].get("missing_information", ["真实使用证据"])
    payload = {
        "missing_evidence": missing[0],
        "why_needed": "没有这项证据，圆桌只能形成条件性结论，不能成为最终决策依据。",
        "risk_if_missing": "产品可能再次退化为演示道具，不能在真实场景中产生生产力。",
        "priority": "high",
        "suggested_source": "用户访谈、试点记录、业务负责人确认或真实运行日志。",
    }
    return make_event(session, agent or system_agent(), "evidence_gap", payload, {"schema_name": "evidence_gap", "runtime_mode": runtime_mode(), "status": "derived", "latency_ms": 0})


def make_report(session, events, store, client):
    output, evidence = client.call_json(
        "report_synthesizer",
        (
            "你是圆桌报告主笔。基于结构化事件生成报告 JSON："
            "{title,executive_summary,quality_score,fatal_flaws,high_risk_gaps,recommendations,next_actions,markdown}。"
            "报告必须可执行，不能只复述流程。"
        ),
        {"session": session, "events": events},
    )
    markdown = output.get("markdown") if isinstance(output, dict) else None
    if not markdown:
        markdown = fallback_markdown_report(session, events)
    return {
        "artifact_id": new_id("art"),
        "session_id": session["session_id"],
        "artifact_type": "markdown_report",
        "title": output.get("title") if isinstance(output, dict) and output.get("title") else "圆桌评审报告",
        "markdown": markdown,
        "trace_event_ids": [event["event_id"] for event in events],
        "runtime_evidence": [evidence],
        "quality_score": output.get("quality_score") if isinstance(output, dict) else "dev-degraded",
        "created_at": now_iso(),
    }


def fallback_markdown_report(session, events):
    profile = session["task_profile"]
    positions = [event for event in events if event["event_type"] == "position"]
    challenges = [event for event in events if event["event_type"] == "challenge"]
    consensus = next((event for event in events if event["event_type"] == "consensus"), None)
    mode_note = "本报告由透明开发降级运行时生成，不可作为生产质量验收。" if runtime_mode() != "openai" else "本报告由真实模型运行时生成。"
    return "\n".join(
        [
            "# 圆桌评审报告",
            "",
            f"> 运行说明：{mode_note}",
            "",
            "## 一句话结论",
            "",
            consensus["payload"].get("statement", "形成条件性共识。") if consensus else "形成条件性共识。",
            "",
            "## 任务画像",
            "",
            f"- 行业：{profile.get('industry')}",
            f"- 用户目标：{profile.get('user_goal')}",
            f"- 决策类型：{profile.get('decision_type')}",
            f"- 风险等级：{profile.get('risk_level')}",
            f"- 必要视角：{'、'.join(profile.get('required_perspectives', []))}",
            "",
            "## 主要观点",
            "",
            *[f"- **{event['agent_name']}**：{event['payload'].get('claim')}" for event in positions],
            "",
            "## 关键质疑",
            "",
            *[f"- **{event['agent_name']}**：{event['payload'].get('challenge_text')}" for event in challenges],
            "",
            "## 证据缺口",
            "",
            *[f"- {item}" for item in profile.get("missing_information", [])],
            "",
            "## 下一步行动",
            "",
            "- 补齐缺失信息和真实场景证据。",
            "- 用小范围任务验证报告是否能直接帮助决策。",
            "- 若运行时不是 openai，配置真实 OpenAI-compatible API 后重新执行。",
            "",
            "## 事件索引",
            "",
            *[f"- {event['event_id']}：{event['event_type']} / {event['agent_name']}" for event in events],
        ]
    )


def dev_position_payload(agent, session):
    profile = session["task_profile"]
    return {
        "claim": f"{agent['display_name']} 认为本任务不能停留在泛泛建议，必须围绕“{profile['user_goal']}”形成可验证方案。",
        "rationale": f"该 Agent 的职责是：{agent.get('summary', '')}",
        "assumptions": profile.get("assumptions", []),
        "risks": profile.get("missing_information", [])[:3] or ["证据不足"],
        "evidence_refs": ["user_problem", "task_profile"],
        "confidence_level": "medium" if runtime_mode() == "openai" else "dev_degraded",
        "challenge_requested": True,
    }


def make_event(session, agent, event_type, payload, evidence):
    return {
        "event_id": new_id("evt"),
        "session_id": session["session_id"],
        "run_id": session["run_id"],
        "turn_id": f"{event_type}_{int(time.time() * 1000)}",
        "event_type": event_type,
        "actor_type": "agent",
        "actor_id": agent.get("agent_id", "system"),
        "agent_id": agent.get("agent_id", "system"),
        "agent_name": agent.get("display_name", "System"),
        "agent_version_id": agent.get("current_version_id", "system:v1"),
        "visible_to_user": True,
        "payload": payload,
        "runtime_evidence": evidence,
        "created_at": now_iso(),
    }


def public_agent(agent):
    return {
        "agent_id": agent.get("agent_id"),
        "display_name": agent.get("display_name"),
        "summary": agent.get("summary"),
        "capabilities": agent.get("capabilities", []),
        "responsibilities": agent.get("responsibilities", []),
        "boundaries": agent.get("boundaries", []),
        "quality_status": agent.get("quality_status"),
    }


def system_agent():
    return {"agent_id": "system", "display_name": "System", "current_version_id": "system:v1"}


def create_personal_agent_from_request(body, store):
    request_text = required_text(body.get("requestText"), "requestText")
    profile = heuristic_profile(request_text, "", "Agent 能力补充")
    scored = sorted(
        [{"agent": agent, "score": score_agent(agent, profile)} for agent in store.list("agents")],
        key=lambda item: item["score"],
        reverse=True,
    )
    matches = [item for item in scored if item["score"] >= 8][:5]
    if matches:
        return {
            "mode": "matched_existing",
            "matches": [
                {
                    "agent_id": item["agent"]["agent_id"],
                    "display_name": item["agent"]["display_name"],
                    "agent_class": item["agent"]["agent_class"],
                    "score": item["score"],
                    "reason": "已有 Agent 能覆盖该诉求的一部分。",
                }
                for item in matches
            ],
            "draft": None,
        }
    generated = ensure_personal_agent(profile["required_perspectives"][0], {**profile, "task_profile_id": new_id("task"), "original_problem": request_text}, store)
    return {"mode": "created_personal_draft", "matches": [], "draft": generated}


SUPPORTED_RESOURCE_TYPES = {"file", "network", "database", "tool"}
DEFAULT_POLICY = {
    "file": {"allowed": ["read_summary", "read_metadata"], "denied": ["read_full", "write", "delete"]},
    "network": {"allowed": ["openai_api"], "denied": ["arbitrary_fetch", "crawl", "download"]},
    "database": {"allowed": ["read_session", "write_trace_event", "write_artifact", "write_share_record"], "denied": ["export_all_users", "delete_without_confirmation"]},
    "tool": {"allowed": ["roundtable_runtime", "agent_matcher", "report_generator"], "denied": ["shell", "server_admin", "external_publish"]},
}


def evaluate_policy(request):
    resource_type = str(request.get("resource_type") or "")
    action = str(request.get("action") or "")
    actor_type = str(request.get("actor_type") or "system")
    context = {"resource_type": resource_type, "action": action, "actor_type": actor_type, "session_id": request.get("session_id")}
    if resource_type not in SUPPORTED_RESOURCE_TYPES:
        return policy_decision("deny", "unsupported_resource_type", context)
    if not action:
        return policy_decision("deny", "missing_action", context)
    policy = DEFAULT_POLICY[resource_type]
    if action in policy["denied"]:
        return policy_decision("deny", "action_requires_explicit_approval_or_future_policy", context)
    if action in policy["allowed"]:
        return policy_decision("allow", "allowed_by_gateway_policy", context)
    return policy_decision("review", "unknown_action_requires_policy_extension", context)


def policy_decision(result, reason, context):
    return {"decision_id": new_id("policy"), "result": result, "reason": reason, "context": context, "created_at": now_iso()}


class Handler(BaseHTTPRequestHandler):
    store = None
    client = None

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_common_headers()
        self.end_headers()

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def route(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/health" and self.command == "GET":
                return self.send_json(
                    {
                        "ok": True,
                        "service": "ars-ai-orchestrator-python",
                        "architecture": "java-api-gateway-python-ai-orchestrator",
                        "runtime": runtime_mode(),
                        "openaiConfigured": self.client.configured(),
                        "timestamp": now_iso(),
                    }
                )
            if path == "/api/settings" and self.command == "GET":
                return self.send_json(
                    {
                        "appEnv": env("APP_ENV", "development"),
                        "aiRuntime": runtime_mode(),
                        "openaiConfigured": self.client.configured(),
                        "dataStore": "json",
                        "architecture": "java-api-gateway-python-ai-orchestrator",
                    }
                )
            if path == "/api/agents" and self.command == "GET":
                query = urllib.parse.parse_qs(parsed.query)
                agent_class = query.get("class", [""])[0]
                agents = [agent for agent in self.store.list("agents") if not agent_class or agent.get("agent_class") == agent_class]
                return self.send_json({"agents": agents})
            if path == "/api/agents/request" and self.command == "POST":
                return self.send_json(create_personal_agent_from_request(self.read_json(), self.store), 201)
            share_match = re.match(r"^/api/agents/([^/]+)/share$", path)
            if share_match and self.command == "POST":
                return self.share_agent(share_match.group(1))
            if path == "/api/policy/evaluate" and self.command == "POST":
                decision = evaluate_policy(self.read_json())
                self.store.insert("policy_decisions", decision)
                return self.send_json({"policyDecision": decision})
            if path == "/api/sessions" and self.command == "GET":
                sessions = [
                    {
                        "session_id": item["session_id"],
                        "status": item["status"],
                        "current_stage": item["current_stage"],
                        "problem": item["problem"],
                        "created_at": item["created_at"],
                        "completed_at": item.get("completed_at"),
                    }
                    for item in self.store.list("sessions")
                ]
                return self.send_json({"sessions": sessions})
            if path == "/api/sessions" and self.command == "POST":
                session = create_session(self.read_json(), self.store, self.client)
                return self.send_json({"session": session}, 201)
            session_match = re.match(r"^/api/sessions/([^/]+)$", path)
            if session_match and self.command == "GET":
                return self.send_session(session_match.group(1))
            run_match = re.match(r"^/api/sessions/([^/]+)/run$", path)
            if run_match and self.command == "POST":
                session = self.store.get("sessions", "session_id", run_match.group(1))
                if not session:
                    return self.send_json({"error": "session_not_found"}, 404)
                return self.send_json(run_roundtable(session, self.store, self.client))
            export_match = re.match(r"^/api/export/sessions/([^/]+)$", path)
            if export_match and self.command == "GET":
                return self.send_session(export_match.group(1), attachment=True)
            return self.send_json({"error": "not_found"}, 404)
        except HttpError as exc:
            return self.send_json({"error": "request_error", "message": exc.message}, exc.status)
        except Exception as exc:  # noqa: BLE001
            return self.send_json({"error": "internal_error", "message": str(exc)}, 500)

    def share_agent(self, agent_id):
        body = self.read_json()
        agent_row = self.store.get("agents", "agent_id", agent_id)
        if not agent_row:
            return self.send_json({"error": "agent_not_found"}, 404)
        if agent_row.get("agent_class") == "system_public":
            return self.send_json({"error": "request_error", "message": "System public agents are already shared."}, 409)
        record = self.store.insert(
            "share_records",
            {
                "share_record_id": new_id("share"),
                "agent_id": agent_id,
                "requested_by": body.get("requestedBy") or agent_row.get("owner_user_id") or "local-user",
                "from_visibility_scope": agent_row.get("visibility_scope"),
                "to_visibility_scope": "all_users",
                "review_status": "recorded_for_mvp",
                "sensitive_data_warning_acknowledged": bool(body.get("sensitiveDataWarningAcknowledged")),
                "notes": body.get("notes") or "",
                "created_at": now_iso(),
            },
        )
        updated = self.store.update(
            "agents",
            "agent_id",
            agent_id,
            {
                "agent_class": "shared_public",
                "visibility_scope": "all_users",
                "publish_status": "shared_recorded",
                "share_state": "shared",
                "default_pool_eligible": agent_row.get("trust_status") == "official_verified",
            },
        )
        return self.send_json({"agent": updated, "shareRecord": record})

    def send_session(self, session_id, attachment=False):
        session = self.store.get("sessions", "session_id", session_id)
        if not session:
            return self.send_json({"error": "session_not_found"}, 404)
        events = [event for event in self.store.list("trace_events") if event.get("session_id") == session_id]
        artifacts = [artifact for artifact in self.store.list("artifacts") if artifact.get("session_id") == session_id]
        return self.send_json({"session": session, "events": events, "artifacts": artifacts}, attachment=attachment, filename=f"{session_id}.json")

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            raise HttpError(400, f"Invalid JSON body: {exc}") from exc

    def send_json(self, payload, status=200, attachment=False, filename=None):
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.add_common_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        if attachment and filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data)

    def add_common_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Request-Id")

    def log_message(self, fmt, *args):
        return


class HttpError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def required_text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise HttpError(422, f"{field} is required")
    return value.strip()


def has_any(text, keywords):
    return any(item.lower() in text for item in keywords)


def main():
    store = JsonStore(CONFIG["data_dir"])
    store.init()
    Handler.store = store
    Handler.client = OpenAIClient(CONFIG)
    server = ThreadingHTTPServer((CONFIG["host"], CONFIG["port"]), Handler)
    print(f"ARS Python AI Orchestrator listening on http://{CONFIG['host']}:{CONFIG['port']} runtime={runtime_mode()}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
