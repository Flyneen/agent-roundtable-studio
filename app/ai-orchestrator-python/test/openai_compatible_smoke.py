import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


provider_calls = []


class FakeProvider(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/chat/completions":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        system = next((item.get("content", "") for item in body.get("messages", []) if item.get("role") == "system"), "")
        schema_name = "unknown"
        marker = "schema_name="
        if marker in system:
            schema_name = system.split(marker, 1)[1].split("，", 1)[0].split(",", 1)[0].split()[0]
        provider_calls.append(
            {
                "schema_name": schema_name,
                "authorization": self.headers.get("Authorization", ""),
                "response_format": body.get("response_format", {}).get("type"),
                "model": body.get("model"),
            }
        )
        payload = response_for_schema(schema_name)
        data = json.dumps(
            {
                "id": f"fake-{schema_name}",
                "object": "chat.completion",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": json.dumps(payload, ensure_ascii=False)},
                        "finish_reason": "stop",
                    }
                ],
            },
            ensure_ascii=False,
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return


def response_for_schema(schema_name):
    if schema_name == "task_profile_agent":
        return {
            "task_type": "真实模型教育场景审议",
            "industry": "教育",
            "user_goal": "形成弱硬件学校可落地的英语 AI 教学方案",
            "decision_type": "教学改革方案评审",
            "risk_level": "high",
            "required_perspectives": ["教育行业专家", "教学设计", "学习评估", "学校落地", "数据隐私"],
            "missing_information": ["学校网络条件", "教师 AI 能力"],
            "clarifying_questions": ["学校是否允许学生使用个人设备？"],
            "evidence_needs": ["课堂流程", "评价指标"],
            "assumptions": ["硬件条件弱是关键约束"],
            "constraints": ["不能依赖高配终端"],
        }
    if schema_name == "agent_selector_agent":
        return {
            "panel_summary": "模型选择教育、教学设计、学习评估、学校落地和隐私相关 Agent。",
            "selected_agent_ids": [
                "agent-instructional-designer",
                "agent-learning-assessment",
                "agent-school-deployment-advisor",
                "agent-data-privacy-officer",
                "agent-reality-checker",
            ],
            "excluded_agents": [{"agent_id": "agent-ui-designer", "reason": "当前不是视觉设计任务。"}],
            "missing_perspectives": [],
            "selection_notes": ["阵容围绕真实学校落地，不围绕演示 UI。"],
        }
    if schema_name == "agent_position_event":
        return {
            "claim": "需要从课堂目标、低硬件约束和教师工作流切入，而不是直接堆 AI 功能。",
            "rationale": "教育场景首先要证明教师能用、学生能完成、学校能管理。",
            "assumptions": ["学校硬件条件较弱"],
            "risks": ["教师负担增加", "效果不可量化"],
            "evidence_refs": ["task_profile"],
            "confidence_level": "medium_high",
            "challenge_requested": True,
        }
    if schema_name == "critic_agent":
        return {
            "target_event_id": "provider-will-be-overwritten",
            "challenge_type": "implementation_gap",
            "severity": "high",
            "challenge_text": "方案必须说明低硬件条件下如何采集、反馈和评价，否则不可落地。",
            "required_response": True,
            "evidence_refs": ["task_profile"],
        }
    if schema_name == "agent_response_revision":
        return {
            "challenge_id": "provider-will-be-overwritten",
            "response_type": "accepted",
            "response_text": "接受质疑，方案改为先做低硬件课堂闭环。",
            "accepted_changes": ["增加低硬件约束", "补充评价指标"],
            "remaining_disagreement": "仍需学校确认设备和网络。",
            "revised_claim": "先围绕教师备课、课堂练习和形成性反馈做低硬件闭环。",
        }
    if schema_name == "consensus_synthesizer":
        return {
            "consensus_type": "conditional_consensus",
            "statement": "可以推进，但必须以低硬件课堂闭环、教师工作流和学习评估为主线。",
            "supporting_event_ids": [],
            "confidence_level": "medium_high",
            "remaining_risks": ["学校设备条件未确认"],
            "disagreements": ["是否需要学生端设备仍未确定"],
            "next_actions": ["确认学校设备", "设计一节课试点", "定义评价指标"],
        }
    if schema_name == "report_synthesizer":
        return {
            "title": "教育场景圆桌评审报告",
            "executive_summary": "AI 英语教学应从低硬件课堂闭环切入。",
            "quality_score": "7/10",
            "fatal_flaws": [],
            "high_risk_gaps": ["学校设备和网络条件未确认"],
            "recommendations": ["先做教师端和课堂投屏/纸笔结合方案"],
            "next_actions": ["跑一节课试点"],
            "markdown": "# 圆桌评审报告\n\n## 一句话结论\n\n可以推进低硬件英语教学 AI 方案，但必须先试点验证。\n\n## 关键质疑\n\n低硬件约束未确认。\n",
        }
    return {}


def main():
    provider = ThreadingHTTPServer(("127.0.0.1", 0), FakeProvider)
    provider_port = provider.server_address[1]
    thread = threading.Thread(target=provider.serve_forever, daemon=True)
    thread.start()

    with tempfile.TemporaryDirectory() as tmp:
        orchestrator_port = find_free_port()
        env = os.environ.copy()
        env.update(
            {
                "AI_RUNTIME": "openai",
                "ORCHESTRATOR_HOST": "127.0.0.1",
                "ORCHESTRATOR_PORT": str(orchestrator_port),
                "DATA_DIR": tmp,
                "OPENAI_BASE_URL": f"http://127.0.0.1:{provider_port}",
                "OPENAI_API_MODE": "chat_completions",
                "OPENAI_API_KEY": "test-compatible-key",
                "OPENAI_MODEL": "qwen-compatible-test",
                "OPENAI_TIMEOUT_MS": "5000",
                "OPENAI_MAX_RETRIES": "0",
            }
        )
        proc = subprocess.Popen(
            [sys.executable, "ai-orchestrator-python/src/orchestrator.py"],
            cwd=Path(__file__).resolve().parents[2],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            wait_for(f"http://127.0.0.1:{orchestrator_port}/health", proc)
            created = post(
                orchestrator_port,
                "/api/sessions",
                {
                    "problem": "如何将 AI 赋能到英语教学当中，尤其是硬件条件比较弱的初中学校？",
                    "background": "初中、英语、论文。",
                    "targetOutput": "教育场景报告",
                },
            )
            if created["session"]["task_profile"]["runtime_mode"] != "openai":
                raise AssertionError("Task profile did not use openai runtime.")
            result = post(orchestrator_port, f"/api/sessions/{created['session']['session_id']}/run", {})
            if result["session"]["status"] != "complete":
                raise AssertionError("Roundtable did not complete.")
            schemas = {item["schema_name"] for item in provider_calls}
            expected = {"task_profile_agent", "agent_selector_agent", "agent_position_event", "critic_agent", "agent_response_revision", "consensus_synthesizer", "report_synthesizer"}
            missing = expected - schemas
            if missing:
                raise AssertionError(f"Provider calls missing: {missing}")
            if not all(item["authorization"] == "Bearer test-compatible-key" for item in provider_calls):
                raise AssertionError("Authorization header missing.")
            if not all(item["response_format"] == "json_object" for item in provider_calls):
                raise AssertionError("JSON response format missing.")
            print("Python OpenAI-compatible smoke passed:", created["session"]["session_id"], len(provider_calls), "provider calls")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
            provider.shutdown()


def find_free_port():
    server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
    port = server.server_address[1]
    server.server_close()
    return port


def wait_for(url, proc):
    deadline = time.time() + 10
    while time.time() < deadline:
        if proc.poll() is not None:
            output = proc.stdout.read() if proc.stdout else ""
            raise RuntimeError(f"orchestrator exited early:\n{output}")
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    output = proc.stdout.read() if proc.stdout else ""
    raise TimeoutError(f"orchestrator did not start:\n{output}")


def post(port, path, body):
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()
