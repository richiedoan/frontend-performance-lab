# Frontend Performance Lab — Bộ prompt tiếng Việt cho Codex

Chạy lần lượt từng prompt tại thư mục gốc repository. Chỉ chuyển sang bước tiếp theo khi bước hiện tại đã đạt tiêu chí nghiệm thu.

## Bước 1 — Khởi tạo project

```text
Hãy kiểm tra repository hiện tại trước khi chỉnh sửa và bảo toàn mọi thay đổi không liên quan của người dùng.

Khởi tạo hoặc hoàn thiện ứng dụng Next.js dùng React, TypeScript strict và Yarn Classic 1.22.22. Khai báo `"packageManager": "yarn@1.22.22"`, tạo và duy trì `yarn.lock`, không tạo lockfile của package manager khác. Tạo ba route tạm: /baseline, /optimized và /case-study. Cấu hình ESLint, Prettier, Vitest và Playwright; thêm script dev, build, lint, typecheck, unit test, E2E test và validate. Dùng Yarn cho mọi thao tác dependency và package script.

Chỉ làm hạ tầng project. Chưa xây dashboard, mock data, lỗi hiệu năng hay optimization.

Tiêu chí nghiệm thu:
- Ba route render được nội dung nhận diện riêng.
- TypeScript strict được bật.
- Unit test tối thiểu và E2E smoke test chạy thành công.
- Production build thành công.

Chạy lint, typecheck, unit test, E2E liên quan và production build. Cuối cùng báo cáo file đã đổi, kết quả lệnh, giả định và hạn chế. Không commit nếu chưa được yêu cầu.
```

## Bước 2 — Thiết lập tài liệu nền tảng

```text
Kiểm tra tài liệu hiện có. Tạo hoặc cập nhật docs/project-scope.md, docs/architecture.md, docs/benchmark-protocol.md và docs/evidence-policy.md.

Repository sử dụng Yarn Classic 1.22.22. Hãy dùng cú pháp Yarn trong mọi command và tài liệu, coi `yarn.lock` là package-manager lockfile duy nhất và không tạo lockfile của package manager khác.

Ghi rõ: sản phẩm là Live Market Explorer generic; có /baseline, /optimized, /case-study; hai implementation phải cùng UI, data, tính năng và hành vi quan sát được; mặc định 5.000 records với seed 20260911; benchmark lấy median của 5 lần hợp lệ; không công bố claim thiếu evidence; mỗi measured value phải trỏ tới raw evidence; dữ liệu thiếu phải là not-available; không gọi lab metric là field INP; mỗi experiment cô lập một biến implementation chính.

Bổ sung non-goals, experiment invariants, evidence requirements và kiến trúc repository. Chưa sửa code chức năng. Kiểm tra tính nhất quán và internal links, sau đó báo cáo file đã đổi và quyết định còn bỏ ngỏ.
```

## Bước 3 — Tạo dữ liệu market deterministic

```text
Kiểm tra types và test conventions hiện tại. Xây dựng mock-data generator TypeScript dùng chung cho Live Market Explorer.

Repository sử dụng Yarn Classic 1.22.22. Dùng Yarn cho mọi dependency và package-script command, bảo toàn `yarn.lock`, không tạo lockfile của package manager khác.

Định nghĩa MarketRecord có stable ID, name, category, status, price, change, volume, updatedAt, image metadata và chart history. Hỗ trợ record count tùy chỉnh, mặc định 5.000; seed tùy chỉnh, mặc định 20260911. Cùng seed và count phải luôn sinh output giống nhau. Không dùng Math.random trực tiếp ngoài seeded generator.

Viết unit test cho determinism, count, unique ID, valid ranges và sự khác nhau giữa hai seed. Không làm API hoặc UI. Chạy lint, typecheck và unit test liên quan; báo cáo file và kết quả.
```

## Bước 4 — Tạo mock API

```text
Dùng lại deterministic generator để xây API cho market collection, market detail và summary. Hỗ trợ seed, record count và simulated delay với validation, giới hạn an toàn và default rõ ràng. Thêm cách mô phỏng lỗi có kiểm soát cho automated test.

Repository sử dụng Yarn Classic 1.22.22. Dùng Yarn cho mọi dependency và package-script command, bảo toàn `yarn.lock`, không tạo lockfile của package manager khác.

Định nghĩa response schema ổn định; trả HTTP status phù hợp cho request sai và record không tồn tại. Viết contract tests cho deterministic response, validation, missing record, delay và error simulation.

Chưa tạo duplicate request, cache problem hoặc request cancellation. Chạy lint, typecheck, test liên quan và production build; báo cáo endpoint contract và kết quả.
```

## Bước 5 — Xây shared presentation components

```text
Tạo presentation layer dùng chung gồm DashboardShell, toolbar, search input, filters, table header, market row, summary cards, loading skeleton, empty state, error state và detail drawer.

Tạo design tokens và responsive rules. Component chỉ nhận typed props và callback; không chứa logic xử lý riêng của baseline/optimized. Reserve kích thước ổn định cho row, image, skeleton và chart. Dùng semantic HTML, labels và keyboard/focus behavior cơ bản.

Thêm component tests cần thiết. Chưa làm virtualization, Web Worker, artificial leak hoặc performance claim. Chạy lint, typecheck, test liên quan và build; báo cáo component boundaries và kết quả.
```

## Bước 6 — Định nghĩa behavioral contract

```text
Định nghĩa observable behavioral contract mà cả /baseline và /optimized phải tuân thủ: search theo tên, filter category/status, sort price/volume, expand row, mở/đóng detail drawer, refresh semantics, loading, empty, error và keyboard interaction.

Chỉ dùng chung pure domain functions khi việc chia sẻ không làm mất ý nghĩa so sánh. Tạo stable test selectors và Playwright journey helpers dùng chung. Viết unit test cho search/filter/sort và document ordering/refresh semantics.

Chưa xây hai implementation hiệu năng khác nhau. Chạy lint, typecheck và test liên quan; báo cáo contract và kết quả.
```

## Bước 7 — Xây reference dashboard

```text
Dựa trên data, API, components và behavioral contract hiện có, xây một reference Live Market Explorer hoàn chỉnh: load deterministic dataset, hỗ trợ mọi interaction đã thống nhất, detail chart, refresh và mobile responsive.

Ưu tiên correctness và component boundaries rõ ràng. Chưa cố tình tạo performance problem, memory leak hoặc advanced optimization; chưa gọi implementation này là baseline hay optimized.

Viết test cho complete user journey. Chạy lint, typecheck, unit test, E2E liên quan và production build; báo cáo behavior đã hoàn thiện và hạn chế.
```

## Bước 8 — Nối route và kiểm tra parity

```text
Nối /baseline và /optimized vào hai implementation entry point riêng nhưng trước mắt giữ hành vi giống nhau. Có thể dùng chung presentation code, nhưng phải tách được data/lifecycle logic đặc thù.

Tạo Playwright parity suite dạng parameterized chạy cùng journey trên cả hai route. So sánh initial data, search, filter, sort order, detail content, refresh, loading/error và accessibility behavior quan trọng với seed 20260911.

Chưa thêm bottleneck hoặc optimization. Chạy lint, typecheck, unit test, parity/E2E và build; báo cáo parity.
```

## Bước 9 — Định nghĩa experiment records

```text
Xây typed schemas cho experiment definition, approach, environment, artifact, measured value, missing result và experiment run; tạo experiment registry nhưng không bịa measurements.

Mỗi measured value phải có value, unit, aggregation method, sample count và evidence path. Thông tin thiếu phải biểu diễn bằng not-available kèm reason. Thêm runtime validation cho records được case study đọc.

Tạo các run module rỗng/not-available cho experiment dự kiến. Viết test cho valid/invalid record, missing evidence và unavailable result. Chưa làm benchmark runner. Chạy lint, typecheck, test và báo cáo schema.
```

## Bước 10 — Tạo scenario configuration

```text
Tạo scenario selection deterministic cho /baseline và /optimized, tối thiểu gồm default, large-list, search-input, worker-aggregation, interval-memory-leak, listener-memory-leak và detached-dom-memory-leak.

Đọc scenario, seed và record count từ URL parameters đã validate, có safe default và bounded values. Không dùng global mutable flags. Trong development, hiển thị indicator nhỏ cho active scenario và dataset. Invalid params phải fallback hoặc báo lỗi theo cách đã document.

Viết unit/E2E tests cho valid, invalid và deterministic config trên hai route. Chưa implement vấn đề của từng scenario. Chạy validation đầy đủ và báo cáo.
```

## Bước 11 — Tạo evidence scaffolding

```text
Xây script tạo evidence directory cho một experiment run và script validate run đã hoàn tất.

Mỗi run hỗ trợ prompt.md, output.md, diff.patch, tests.txt, environment.json, raw-results.json, human-evaluation.md và optional trace/heap/screenshot. Không tạo fake measurements. Validator phải kiểm tra metadata bắt buộc, safe relative paths, file evidence tồn tại, units, aggregation metadata và reason cho unavailable values.

Thêm package scripts, test fixtures và tài liệu sử dụng. Demo bằng temporary directory, không làm bẩn evidence thật. Chạy lint, typecheck, test và báo cáo.
```

## Bước 12 — Baseline large-list

```text
Chỉ implement phía baseline của experiment large-list. Với /baseline?scenario=large-list, render toàn bộ số records cấu hình, mặc định 5.000, không virtualization. Giữ nguyên behavioral contract và shared UI.

Không thêm network problem, memory leak, blocking chart hoặc regression không liên quan. Thêm instrumentation/stable markers để đếm rendered rows và DOM nodes.

Viết test xác nhận toàn bộ records xuất hiện trong baseline DOM và interactions vẫn đúng. Chưa làm optimized hoặc measurement. Chạy lint, typecheck, unit, parity/E2E và build; báo cáo.
```

## Bước 13 — Optimized virtualization

```text
Implement phía optimized của large-list bằng thư viện React virtualization phù hợp. Với /optimized?scenario=large-list, chỉ render visible window và overscan nhỏ có document, nhưng phải giữ nguyên data, UI, sort/filter, drawer và kết quả như baseline.

Giữ keyboard accessibility, stable row identity, scrolling và khả năng mở record xác định. Không thêm optimization khác. Viết tests chứng minh functional parity và giới hạn số row elements trong DOM.

Chạy lint, typecheck, unit, parity/E2E và build. Báo cáo virtualization config; không bịa performance numbers.
```

## Bước 14 — Search-input experiment

```text
Implement isolated search-input experiment cho cả hai route.

Baseline: chạy expensive search/filter sau mỗi keystroke và không cancel request cũ. Optimized: debounce với delay được document, cancel request lỗi thời bằng AbortController và không cho stale result ghi đè kết quả mới.

Hai route phải cho cùng kết quả cuối với cùng query. Workload phải controlled và reproducible. Instrument request count, calculation count và completion timestamps. Viết fake-timer tests và E2E cho rapid typing, cancellation và stale-response protection.

Không trộn experiment khác. Chạy validation đầy đủ; báo cáo debounce delay và không công bố speedup chưa đo.
```

## Bước 15 — Web Worker aggregation

```text
Implement isolated worker-aggregation experiment bằng deterministic workload.

Baseline chạy aggregation synchronous trên main thread. Optimized chạy logic tương đương trong Web Worker, bỏ qua/cancel obsolete jobs và terminate worker khi cleanup. Normalized outputs của hai route phải giống nhau.

Workload configurable và bounded. Instrument job start/end, result version và cancellation. Viết unit test cho pure aggregation, equivalence test direct/worker và E2E cho rapid input changes/cleanup.

Chạy lint, typecheck, tests và build. Báo cáo worker lifecycle; chưa kết luận Worker nhanh hơn nếu chưa benchmark.
```

## Bước 16 — Render-boundary experiment

```text
Tạo isolated render-boundary scenario. Baseline đặt state và unstable props sao cho tạo unnecessary child renders có thể tái hiện. Optimized localize state, dùng stable props và memoization chỉ tại boundary có lý do.

Thêm development-only render counters hoặc React Profiler marks không ảnh hưởng đáng kể đến production measurement. Hai route phải giữ output và behavior giống nhau. Test behavior/instrumentation, không assert wall-clock duration dễ dao động.

Chạy validation đầy đủ; báo cáo component boundary đã thay đổi và lý do. Không memo hóa lan rộng thiếu evidence.
```

## Bước 17 — Request lifecycle experiment

```text
Implement isolated request-lifecycle experiment.

Baseline tái hiện duplicate request, thiếu cancellation và stale-response race có kiểm soát. Optimized deduplicate in-flight requests, abort request lỗi thời, chặn stale result và dùng bounded cache có TTL/max size rõ ràng.

Hai route phải hội tụ về cùng correct state. Instrument request ID, start/end/abort, cache hit và applied response version. Viết integration/E2E tests tái hiện race deterministic và chứng minh optimized không apply stale data.

Không dùng infinite traffic hoặc unbounded cache. Chạy validation và báo cáo.
```

## Bước 18 — Bundle-loading experiment

```text
Tạo isolated bundle-loading experiment quanh detail chart.

Baseline statically import chart code vào initial route bundle. Optimized dynamic import cùng chart functionality khi cần, với loading fallback accessible và giữ ổn định kích thước. Chart data và output phải giống nhau.

Viết tests cho on-demand loading và drawer usability. Thêm reproducible bundle-analysis command/parser để lấy initial/lazy JS sizes, không nhập tay.

Chạy lint, typecheck, tests, production build và bundle analysis. Chỉ lưu evidence thực tế; báo cáo artifact paths, không suy rộng ngoài dữ liệu đã thu.
```

## Bước 19 — Image và font experiment

```text
Tạo isolated image/font delivery experiment với nội dung và layout tương đương.

Baseline dùng oversized eager images, bỏ intrinsic dimensions trong scenario kiểm soát và font strategy có thể gây layout shift. Optimized dùng responsive modern formats, lazy load ngoài viewport, priority đúng cho LCP candidate, reserved dimensions và stable font strategy.

Scenario phải safe, deterministic và tách khỏi default experience. Viết tests cho image attributes, dimensions, loading priority và placeholders; cập nhật asset/licensing docs.

Chạy validation; không bịa LCP hoặc CLS.
```

## Bước 20 — Interval memory leak

```text
Tạo isolated interval-memory-leak experiment.

Baseline tạo auto-refresh interval có kiểm soát nhưng vẫn active sau component unmount và giữ meaningful reference. Optimized clear interval khi cleanup và tránh stale retained closure. Giới hạn scenario để không gây update vô hạn hoặc làm dev environment mất ổn định.

Viết fake-timer tests lặp mount/unmount, chứng minh baseline còn active work và optimized trở về timer count dự kiến. Thêm instrumentation cho navigation-based memory measurement và hướng dẫn reproduce bằng Chrome DevTools.

Chạy validation; không ghi heap claim nếu chưa có verified run.
```

## Bước 21 — Event-listener memory leak

```text
Tạo isolated event-listener leak. Baseline đăng ký browser listener không được remove khi unmount và handler giữ component data. Optimized dùng stable handler reference và remove đúng listener khi cleanup. Không ảnh hưởng route/scenario khác.

Viết tests lặp mount/unmount rồi dispatch event để thấy accumulated baseline handlers và stable optimized behavior. Thêm instrumentation cho heap-retainer inspection và document manual reproduction.

Chạy lint, typecheck, tests và build; báo cáo behavior đã verify. Không bịa heap measurement.
```

## Bước 22 — Detached-DOM memory leak

```text
Tạo isolated detached-DOM leak khi mở/đóng detail drawer lặp lại.

Baseline remove nodes khỏi UI nhưng giữ reference qua closure/cache có kiểm soát. Optimized chỉ lưu serializable ID/data và clear hoặc bound state đúng lifecycle. Leak chỉ tồn tại trong baseline scenario.

Viết test cho repeated cycles và retained-reference instrumentation. Document cách dùng Detached Elements và Heap Snapshot để verify; không dùng jsdom làm bằng chứng duy nhất cho claim browser memory.

Chạy validation; báo cáo limitations và không kết luận memory improvement trước verified browser run.
```

## Bước 23 — Combined memory journey

```text
Tạo automated Chrome memory journey lặp Dashboard → Detail → Dashboard 10 lần cho route/scenario được chọn. Sau mỗi vòng, chờ cleanup, chỉ forced GC trong benchmark browser khởi chạy với flag phù hợp, rồi ghi used heap, DOM node count và detached-node signal nếu hỗ trợ.

Ghi mọi cycle, browser/version, route, scenario, seed và failures vào raw JSON. Không bỏ outlier hoặc failed cycle âm thầm. Điều kiện baseline/optimized phải giống nhau. Có dry-run/test mode không tạo performance claim.

Chỉ cập nhật run records khi artifacts thật đã được tạo và validate. Chạy lint, typecheck, tests; báo cáo usage và limitations.
```

## Bước 24 — Khóa benchmark environment

```text
Xây và document reproducible benchmark environment. Pin Node/Yarn Classic 1.22.22 và Chrome for Testing khi khả thi. Định nghĩa viewport 390x844, CPU throttling, network profile, seed 20260911, 5.000 records, cache state và 5 measured iterations.

Tạo machine-readable environment schema và preflight command để đọc/validate điều kiện thật. Critical mismatch phải fail rõ ràng. Generated environment artifact phải có commit SHA và OS metadata.

Chưa chạy hoặc công bố benchmark comparison. Viết test cho accepted/rejected fixtures và báo cáo.
```

## Bước 25 — Benchmark runner

```text
Xây benchmark runner cho experiment và route được chọn. Runner phải chạy production build, thực hiện warm-up policy đã document, chạy 5 measured iterations, giữ từng raw result, ghi failures và tính median.

Cung cấp command tương đương:
- yarn benchmark <experiment> --route=baseline
- yarn benchmark <experiment> --route=optimized
- yarn benchmark:compare <experiment>

Không chọn best run, bỏ outlier âm thầm hoặc overwrite run cũ. Ghi vào unique evidence directory và link summary tới raw inputs. Có safe dry-run mode. Viết tests cho median, failed iterations, unique run IDs và evidence generation.

Chạy validation; không tạo benchmark output giả.
```

## Bước 26 — Lighthouse collection

```text
Tích hợp Lighthouse vào production benchmark workflow dưới fixed environment policy. Thu LCP, CLS, TBT, Speed Index, transfer size và JavaScript execution data cho mỗi iteration, đồng thời giữ original report.

Không gọi TBT hoặc synthetic interaction duration là INP. Field INP phải not-available nếu không có RUM evidence. Baseline/optimized dùng cùng config và cache policy; aggregate bằng median.

Viết validation và result parsing tests. Chỉ chạy thật khi preflight pass; phân biệt rõ real evidence với fixture. Báo cáo limitations.
```

## Bước 27 — Regression budgets

```text
Tạo performance regression-budget validator dựa trên verified summaries. Ban đầu so optimized với baseline/approved reference cho initial JS bytes, long-task count, DOM node count và search duration; chưa đặt absolute target thiếu dữ liệu.

Định nghĩa metric direction, unit, missing behavior và tolerance. Missing/incompatible evidence phải là unavailable/invalid, không được pass. Viết tests cho improvement, regression, missing data, incompatible environment và giá trị sát tolerance.

Để validator là opt-in command, chưa bắt buộc trên shared CI runner. Chạy validation và báo cáo semantics.
```

## Bước 28 — Evidence-driven case study

```text
Xây /case-study đọc validated experiment run records, không hard-code performance numbers.

Hiển thị purpose, baseline/optimized approaches, environment, median/sample count, comparison được hỗ trợ, evidence references, limitations và unavailable states. Chỉ render biểu đồ Core Web Vitals lab, runtime và repeated-navigation memory khi có dữ liệu tương thích.

Không hiển thị INP nếu thiếu field evidence; không tính percentage giữa units/environments khác nhau. Trang phải responsive, semantic và accessible. Viết unit tests cho transformation và E2E cho populated, partial, unavailable data.

Chạy validation và báo cáo data provenance.
```

## Bước 29 — AI-assistance decision records

```text
Tạo format và tài liệu cho AI-assistance investigation log. Mỗi record có question, AI hypothesis, evidence inspected, source locations, decision, accepted/rejected, reasoning, related diff và before/after measurement references nếu có.

Validator không cho đánh dấu verified nếu thiếu evidence. Chỉ tạo templates, không viết investigation giả. Case study chỉ hiển thị accepted/rejected suggestion đã verify.

Document workflow: record trace → tìm bottleneck → hỏi AI → kiểm tra evidence/source → thay đổi một biến → đo lại cùng điều kiện → accept/reject. Chạy validation và báo cáo.
```

## Bước 30 — SEO và accessibility

```text
Audit và hoàn thiện SEO/accessibility: unique metadata, canonical, Open Graph, sitemap, robots; case-study narrative phải crawlable và không phụ thuộc hoàn toàn client rendering. Dùng semantic headings/landmarks; kiểm tra keyboard, drawer focus trap/restoration, form labels, status announcements, contrast và reduced motion.

Không gọi accessibility score là SEO metric và không index toàn bộ 5.000 dashboard records. Thêm accessibility smoke tests nếu tooling hỗ trợ và document manual checks còn lại.

Chạy lint, typecheck, tests và build; báo cáo findings và unresolved checks.
```

## Bước 31 — CI

```text
Kiểm tra hosting environment rồi tạo CI pipeline cho deterministic correctness: install theo lockfile, lint, typecheck, unit tests, parity/E2E và production build. Cache dependencies an toàn.

Giữ full performance/memory benchmarks ở manual hoặc scheduled job trừ khi runner dedicated và validated. Job benchmark phải chạy preflight, giữ artifacts và không publish claim từ invalid environment.

Document branch/MR behavior, required checks, artifact retention và local reproduction. Validate CI config và chạy local commands tương ứng; báo cáo limitations.
```

## Bước 32 — Final verification

```text
Thực hiện final verification cho Frontend Performance Lab. Bắt đầu bằng read-only inspection của git status, docs, scripts, experiment registry và evidence. Bảo toàn unrelated changes; không tự điền kết quả thiếu.

Xác minh:
- Dependency installation reproducible.
- Lint, typecheck, unit, parity/E2E và production build pass.
- /baseline và /optimized cùng behavioral contract.
- Experiment được cô lập và reproducible.
- Run records validate; mọi measurement trỏ tới evidence tồn tại.
- Missing measurements vẫn unavailable.
- Case-study sinh số liệu từ validated records.
- Lab metrics được gắn nhãn đúng.
- README đủ hướng dẫn setup, scenarios, benchmark, evidence và limitations.

Chỉ sửa defect rõ ràng nằm trong scope. Không chạy expensive benchmark nếu chưa được yêu cầu hoặc preflight fail. Xuất readiness report gồm passed checks, blockers, unverified measurements và next action.
```

## Chỉ dẫn chuẩn để thêm vào prompt khi repository đang được phát triển

```text
Trước khi sửa, kiểm tra git status và các file liên quan. Mọi thay đổi hiện có thuộc về người dùng. Hãy bảo toàn chúng, tránh broad rewrite và không sửa experiment/run record không liên quan. Ưu tiên conventions hiện có của repository nếu khác giả định trong prompt. Chỉ hỏi lại khi quyết định còn thiếu có thể làm thay đổi đáng kể implementation.
```
