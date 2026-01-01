INSERT OR REPLACE INTO pages (page_key, page_json, updated)
VALUES (
  'department',
  '{
    "title": "부서 소개",
    "teams": [
      { "name": "감사팀", "description": "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { "name": "인사팀", "description": "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { "name": "특수 검거 기동대(SCP)", "description": "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { "name": "특공대(SOU)", "description": "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { "name": "항공팀(ASD)", "description": "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." }
    ]
  }',
  datetime('now')
);
