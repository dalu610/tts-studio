1. 角色与目标 (Role & Context)
Role: 你是一名精通全栈开发的资深工程师，擅长构建高交互体验的 AI 应用。 Goal: 我需要开发一个用于 TTS（语音合成）模型训练的数据采集 Web 服务。 Tech Stack: (建议明确指定，例如) 前端使用 React + Tailwind CSS + Lucide Icons；后端使用 Python (FastAPI)；数据库使用 SQLite 或本地 JSON 文件即可。

2. 页面布局与交互 (UI/UX Design)
Layout Requirements: 页面采用左右分栏设计（Split-pane layout）：

左侧 (Input Zone):

一个大文本输入框，用户输入“种子话术”（Seed Text）。

一个“生成变体”按钮。点击后调用后端 LLM 接口。

右侧 (Work Zone):

显示由 LLM 生成的 10-20 条变体话术列表。

关键交互 - 录音卡片: 每一条话术都是一个独立的卡片。卡片内包含：

话术文本。

录音控件: 点击“麦克风”图标开始录音，再次点击停止。

波形/状态: 录音时显示动态波形或录音中状态（Recording...）。

回放与重录: 录音完成后，出现“播放”按钮和“删除/重录”按钮。

完成状态: 录完的卡片自动标记为绿色或打钩，方便视觉区分。

3. 核心逻辑与功能 (Core Logic)
Functional Requirements:

Text Expansion (LLM): 后端集成一个 LLM 服务（如调用 OpenAI/Claude API），Prompt 逻辑是：根据用户输入的种子话术，改写并扩充为 15 条风格相似但句式不同的短句，适合语音合成训练。

Audio Handling:

前端使用 MediaRecorder API 进行录音。

音频格式必须是 WAV (PCM), 单声道, 采样率建议 44.1kHz (这是 TTS 训练的标准要求)。

Storage: 录音文件上传到后端 data/wavs 目录，元数据（文件名、对应文本）存入 data/metadata.csv。

Batch Export: 页面顶部有一个“导出数据集”按钮，点击后将所有录音文件和 metadata 打包成一个 .zip 文件下载。

4. 边缘情况与体验优化 (Edge Cases & Polish)
Constraints:

确保录音组件在浏览器中兼容性良好。

生成话术时，右侧显示 Loading 骨架屏。

代码结构清晰，前后端分离，易于我后续修改 Prompt 或更换模型。
