# 씨앗책방 그룹 프로젝트

별도 설치와 빌드가 없는 첫 구현입니다. `index.html`을 열거나 저장소 루트에서 `python3 -m http.server 8080` 실행 후 `/group_project/`로 접속하세요.

- 독서, 감사일기, 느낀점 나누기: 각각 내용 입력 없이 체크/취소
- 9종 캐릭터 선택, 누적 체크 성장, 최근 7일 기록
- 모임 이름 설정, 개인 맛보기 전환
- localStorage로 같은 브라우저에 저장. 작성량에 따른 추가 보상 없음

그룹 서버 연결: 저장소 루트에서 `python3 group_project/dev_server.py` 실행 후 http://127.0.0.1:8080/group_project/ 접속. Flask가 필요합니다(`api/requirements.txt`). 정적 서버로는 개인 체험만 가능합니다.

지도사가 모임을 생성하고 초대 코드를 팀원에게 전달합니다. 팀원 정원은 3명이며 지도사 1명은 별도입니다. 지도사는 오늘 체크 및 최근 7일 현황을 조회하고 팀원 기록을 변경할 수 없습니다. 팀원은 자신의 세 항목을 독립적으로 체크합니다. 기록 날짜는 한국 시간입니다. 현황 새로고침으로 다른 기기의 변경을 가져옵니다.

접속 키는 계정 대신 사용하는 초기 버전의 개인 비밀 키입니다. 탭 세션에만 보관되므로 탭 종료 전 키를 별도로 보관하세요. 비밀번호 계정, 분실 복구, 키 회전, 팀원 교체는 아직 없습니다. 캐릭터는 개인 맛보기에서 임시 이모지로 표시됩니다.

기존 Flask API에 `/groups` 라우트를 등록했습니다. 운영 DB는 정적 배포 경로 밖 `/home/ubuntu/report/data/seed-groups.sqlite3`이며 `SEED_GROUP_DB`로 변경할 수 있습니다. 실제 배포 전 서버 프로세스의 해당 경로 쓰기 권한과 백업을 설정하세요. 로컬 서버 기본 DB는 `~/.local/share/seed-bookstore/groups.sqlite3`입니다. 이번 작업은 배포하지 않습니다.

서버 검증: `cd api && python3 test_seed_groups.py`.

검증: `node group_project/check.cjs` (저장소 루트 기준).
