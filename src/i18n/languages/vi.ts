import type { en } from './en';

export const vi = {
  footerAiAssistance: 'Được xây dựng với sự hỗ trợ của AI.',
  largeDatasetChallengeTitle: 'Hiển thị tập dữ liệu lớn.',
  largeDatasetChallengeBody:
    'Với 5.000 bản ghi, render toàn bộ bảng gây lag nặng. Virtualization còn phải giữ đúng mở rộng hàng, cuộn, điều hướng bàn phím và khôi phục focus.',
  timeoutChallengeTitle: 'Điều tra timeout thay vì tăng thời gian chờ.',
  timeoutChallengeBody:
    'Lỗi xuất hiện khi tải dữ liệu, render bảng và tương tác. Tăng timeout khiến job chạy lâu hơn nhưng chưa giải quyết điểm nghẽn.',
  layerizeChallengeTitle: 'Điều tra browser rendering bị nghẽn.',
  layerizeChallengeBody:
    'Diagnostic local ghi nhận khoảng 87 giây ở Chrome Layerize trước khi click tới ứng dụng. Các probe bỏ radius, đổi border-collapse, tắt transition và bỏ shadow riêng lẻ chưa xác định được nguyên nhân gốc. Việc tái hiện trên Docker/CI vẫn chưa được xác minh.',
  e2eChallengeTitle: 'Giữ E2E ổn định trên CI.',
  e2eChallengeBody:
    'Tốc độ runner, dữ liệu lớn và selector chưa đủ cụ thể có thể gây lỗi. Test cần kiểm tra trạng thái thực tế của ứng dụng, không giảm workload hay bỏ assertion chỉ để pass.',
  environmentChallengeTitle: 'Tái lập môi trường chạy.',
  environmentChallengeBody:
    'Phiên bản Node và Yarn khác nhau, image CI thiếu Git và job benchmark không có runner khớp tag. Chạy trên Mac hoặc Docker không tự động tái hiện điều kiện CI.',
  publicationChallengeTitle: 'Đưa kết quả đã xác thực lên ứng dụng.',
  publicationChallengeBody:
    'Artifacts từ GitLab không tự xuất hiện trên Vercel. Cần luồng import và công bố, xác thực cùng nguồn dữ liệu đi vào deployment. File published-runs.json bị thiếu cũng từng làm typecheck thất bại.',
  aiCollaborationChallengeTitle: 'Phối hợp với AI và kiểm soát phạm vi.',
  aiCollaborationChallengeBody:
    'Cần rà lại cách AI hiểu yêu cầu, bảo toàn thay đổi hiện có và kiểm chứng triển khai bằng test. Phải phân biệt phát hiện đã xác nhận với giả thuyết. Việc bật tất cả scenario ban đầu thêm cả workload demo và diagnostics, nên phải điều chỉnh sau khi xem UI thực tế.',

  openMenu: 'Mở menu',
  closeMenu: 'Đóng menu',
  expandedSnapshot: 'Tổng quan bản ghi {name}',
  snapshotLabel: 'Tổng quan bản ghi',
  snapshotPrice: 'Giá mới nhất',
  snapshotChange: 'Thay đổi trong lịch sử',
  snapshotRange: 'Giá thấp – cao trong lịch sử',
  snapshotVolume: 'Số đơn vị giao dịch',
  snapshotNoHistory: 'Chưa có lịch sử',
  snapshotUpdated: 'Cập nhật lần cuối',
  snapshotContext:
    'Dữ liệu mô phỏng của lab · {count} điểm lịch sử. Mức thay đổi so sánh giá đầu và cuối; khoảng giá bao phủ lịch sử hiện có, không phải một ngày giao dịch cố định.',

  optimizedExplorer: 'Trình khám phá tối ưu',
  combinedOptimizationsHelp:
    'Giữ giao diện khám phá mặc định với danh sách ảo hóa, tìm kiếm debounce và tải biểu đồ khi cần. Request và tác vụ tìm kiếm được hủy khi dọn dẹp. Các bảng thử nghiệm và workload demo bổ sung chỉ xuất hiện trong kịch bản riêng.',
  combinedDefaultsExplanation:
    'Khi không có tham số scenario hoặc dùng URL cũ scenario=default, /optimized mở Trình khám phá tối ưu với các tối ưu cho thao tác khám phá thông thường; /baseline vẫn dùng kịch bản mặc định. Dùng các cặp kịch bản riêng bên dưới để so sánh từng tối ưu.',
  combinedOptimizationsAction:
    'Tìm kiếm, lọc, sắp xếp và cuộn, mở rộng một hàng, sau đó mở rồi đóng một bản ghi.',

  aboutTheProject: 'Về dự án',
  frontendPerformanceLab: 'Frontend Performance Lab',
  aHandsonProjectForUnderstandingHowFrontend:
    'Dự án thực hành giúp tìm hiểu cách triển khai frontend ảnh hưởng đến khả năng phản hồi, hiển thị, tải dữ liệu và bộ nhớ.',
  whatThisProjectIsDesignedToDo: 'Mục tiêu của dự án',
  theLabUsesALiveMarketExplorer:
    'Lab sử dụng Live Market Explorer được xây dựng bằng Next.js, React và TypeScript để so sánh bản đối chứng và bản tối ưu có cùng trải nghiệm chức năng. Dữ liệu giả lập xác định giúp lặp lại các kịch bản, còn các thí nghiệm riêng biệt giúp liên hệ vấn đề hiệu năng với một cách triển khai cụ thể.',
  exploreLargeListsSearchResponsivenessWorkerAggregation:
    'Khám phá danh sách lớn, khả năng phản hồi khi tìm kiếm, tổng hợp bằng worker, phạm vi render, vòng đời request, tải tài nguyên và dọn dẹp bộ nhớ. Mục tiêu là luyện chẩn đoán điểm nghẽn, xem xét đánh đổi và đưa ra kết luận có bằng chứng.',
  referenceBaselineAndOptimized: 'Reference, Baseline và Optimized',
  theThreeExplorersServeDifferentPurposesStart:
    'Ba trang explorer có vai trò khác nhau. Bắt đầu với Reference để hiểu hành vi chung, sau đó so sánh Baseline và Optimized bằng một trong các cặp kịch bản bên dưới.',
  referenceLearnTheExpectedBehavior: 'Reference: tìm hiểu hành vi mong đợi',
  useThisAsAFunctionalReferenceFor:
    'Dùng trang này làm tham chiếu chức năng cho tìm kiếm, lọc, sắp xếp và mở chi tiết bản ghi. Trang giúp bạn hiểu explorer cần làm gì và kiểm tra rằng thay đổi cách triển khai vẫn giữ đúng kết quả. Đây không phải chuẩn đo tốc độ hay cam kết về cách triển khai nhanh nhất.',
  trySearchingForMarket1SortingBy:
    'Thử tìm Market 1, sắp xếp theo giá và mở một bản ghi. Link khởi đầu này sử dụng 60 bản ghi với seed 20260911.',
  openReferenceExplorer: 'Mở Reference Explorer',
  baselineInspectTheComparisonStartingPoint: 'Baseline: xem bản đối chứng',
  thisIsTheControlImplementationForThe:
    'Đây là cách triển khai đối chứng của thí nghiệm đã chọn. Một số kịch bản cố ý thực hiện công việc kém hiệu quả hoặc giữ lại tài nguyên để bạn khảo sát vấn đề cụ thể. Ví dụ, large-list render mọi bản ghi phù hợp, kể cả những bản ghi ngoài vùng nhìn thấy.',
  optimizedExploreATargetedChange: 'Optimized: khám phá thay đổi có mục tiêu',
  thisImplementsTheApproachBeingTestedFor:
    'Đây là phương án đang được thử nghiệm cho kịch bản đã chọn, như ảo hóa danh sách cho large-list hoặc dọn dẹp tài nguyên cho thí nghiệm bộ nhớ. Mục tiêu là giữ kết quả chức năng chung trong khi thay đổi cách thực hiện công việc. Tên gọi này không tự chứng minh tốc độ tăng hay mức sử dụng bộ nhớ giảm.',
  buildingTheProject: 'Quá trình xây dựng dự án',
  builtIn3DaysWithAiSupport: 'Được xây dựng trong 3 ngày với sự hỗ trợ của AI.',
  theBuildBroughtTogetherAnInteractiveDemo:
    'Quá trình xây dựng kết hợp demo tương tác, thí nghiệm có kiểm soát, kiểm tra tự động và báo cáo bằng chứng. Các thách thức kỹ thuật chính gồm:',
  keepingComparisonsFair: 'Đảm bảo so sánh công bằng.',
  bothImplementationsNeedTheSameDataAnd:
    'Baseline và Optimized phải dùng cùng dữ liệu, filter, sort, search và hành vi drawer, bao gồm trạng thái tải, rỗng, lỗi và thử lại, để so sánh có ý nghĩa.',
  isolatingEachBottleneck: 'Tách riêng từng điểm nghẽn.',
  listRenderingSearchWorkersRequestsAndMemory:
    'Render danh sách, tìm kiếm, worker, request và bộ nhớ cần các kịch bản riêng để công việc không liên quan không che khuất tác động đang khảo sát.',
  gettingLifecycleCleanupRight: 'Dọn dẹp đúng theo vòng đời.',
  requestsTimersListenersAndRetainedDomReferences:
    'Search và request cũ phải được hủy, worker kết thúc đúng lúc, timer, listener và tham chiếu DOM được giải phóng khi đổi kịch bản hoặc rời trang.',
  turningObservationsIntoCredibleEvidence:
    'Biến quan sát thành bằng chứng đáng tin cậy.',
  reproducibleRunsValidationAndTraceableArtifactsMatter:
    'Measurement cần evidence tồn tại, run record hợp lệ và đủ lượt để tính median. Timeout và dữ liệu thiếu không được trình bày thành measurement thành công.',
  howToUseTheLab: 'Cách sử dụng lab',
  chooseOneScenarioBelowAndReadIts:
    'Chọn một kịch bản bên dưới và đọc thao tác được gợi ý.',
  openBothVersionsUsingItsOpenBaseline:
    'Mở hai phiên bản bằng các link Mở baseline và Mở optimized của kịch bản đó.',
  keepTheSameScenarioSeedCountAnd:
    'Giữ cùng scenario, seed, count và các tham số riêng của kịch bản. Lặp lại cùng thao tác theo cùng thứ tự ở cả hai phiên bản.',
  separateHowInteractionFeelsFromValidatedMeasurements:
    'Phân biệt cảm nhận khi tương tác với kết quả đo đã được xác thực. Xem',
  caseStudy: 'Nghiên cứu tình huống',
  forEvidenceUnavailableMeansThereIsNo:
    'để xem bằng chứng. Unavailable nghĩa là chưa có kết quả đủ điều kiện công bố; không chứng minh tốc độ tăng hay bộ nhớ được cải thiện.',
  theseLinksAreInteractiveDemosWithModest:
    'Các link này là demo tương tác với khối lượng công việc vừa phải, không phải cấu hình benchmark. Chẩn đoán cục bộ và cảm nhận về độ phản hồi không phải kết quả hiệu năng đã được xác thực. Dùng cùng môi trường cho cả hai phiên bản; với kịch bản bộ nhớ, mở mỗi phiên bản trong tab mới và lặp lại cùng chu kỳ điều hướng. Chỉ riêng tín hiệu dọn dẹp không chứng minh mức sử dụng bộ nhớ giảm.',
  try: 'Thử:',
  full5000recordWorkload: 'Khối lượng đầy đủ 5.000 bản ghi',
  forALocalOrDedicatedEnvironmentWith:
    'Dành cho môi trường local hoặc máy chủ riêng có khả năng trả response đủ lớn. Thao tác có thể chậm. Payload danh sách hiện tại vượt giới hạn kích thước response của Vercel Functions, nên khối lượng đầy đủ này không phù hợp với cách hosting đó.',
  defaultExplorer: 'Explorer mặc định',
  sharedExplorerBehaviorWithoutASelectedOptimization:
    'Hành vi explorer chung khi chưa chọn thí nghiệm tối ưu riêng.',
  searchForMarket1ChangeACategory:
    'Tìm Market 1, đổi bộ lọc danh mục, sắp xếp theo giá, sau đó mở và đóng một bản ghi.',
  largeList: 'Danh sách lớn',
  fulllistRenderingVersusVirtualization:
    'Render toàn bộ danh sách so với ảo hóa danh sách.',
  scrollThroughTheListSortByPrice:
    'Cuộn danh sách, sắp xếp theo giá, sau đó mở rộng một hàng và xem chi tiết.',
  searchResponsiveness: 'Khả năng phản hồi khi tìm kiếm',
  repeatedSearchWorkDebouncingAndCancellationOf:
    'Tính toán tìm kiếm lặp lại, debounce và hủy các lượt tìm kiếm đã bị thay thế.',
  quicklyTypeMarket1ClearItThen:
    'Gõ nhanh Market 1, xóa đi, rồi gõ Market 2. Mở phần chẩn đoán tìm kiếm để xem các request.',
  workerAggregation: 'Tổng hợp bằng worker',
  aggregationOnTheMainThreadVersusA:
    'Tổng hợp trên luồng chính so với Web Worker.',
  changeTheAggregationPassesFrom20To:
    'Đổi số lượt tổng hợp từ 20 lên 40, rồi nhập vào ô tìm kiếm trong khi kết quả tổng hợp cập nhật.',
  renderBoundaries: 'Phạm vi render',
  unrelatedNoteEditsCausingSummaryRenders:
    'Chỉnh sửa ghi chú không liên quan làm phần tổng hợp render lại.',
  typeANoteAndToggleTheSummary:
    'Nhập ghi chú và bật/tắt phần giải thích tổng hợp. Trong chế độ development, so sánh mức thay đổi số lần commit render của phần tổng hợp.',
  requestLifecycle: 'Vòng đời request',
  duplicateRequestsStaleResponsesAndCacheReuse:
    'Request trùng lặp, response cũ và tái sử dụng cache.',
  selectRunRequestRaceWatchTheDiagnostics:
    'Chọn Run request race, theo dõi chẩn đoán đến khi hoàn tất, rồi chạy lại để xem việc tái sử dụng cache.',
  bundleLoading: 'Tải mã ứng dụng',
  eagerVersusOndemandLoadingOfDrawerChart:
    'Tải sẵn so với tải theo nhu cầu phần mã biểu đồ trong ngăn chi tiết.',
  openARecordToLoadItsChart:
    'Mở bản ghi để tải biểu đồ, đóng lại rồi mở lại. Dùng bảng Network để xem các request JavaScript.',
  imageAndFontDelivery: 'Tải ảnh và phông chữ',
  imageSizingLoadingPriorityAndFontDelivery:
    'Kích thước ảnh, độ ưu tiên tải và cách tải phông chữ.',
  reloadEachVersionWithTheSameNetwork:
    'Tải lại mỗi phiên bản với cùng thiết lập mạng, sau đó cuộn qua các hình minh họa và quan sát quá trình tải cùng bố cục.',
  intervalCleanup: 'Dọn dẹp interval',
  timersRetainingRecordSnapshotsAfterUnmount:
    'Timer giữ lại bản chụp dữ liệu sau khi unmount.',
  waitForAnAutorefreshTickNavigateTo:
    'Đợi một nhịp tự cập nhật, chuyển đến Overview rồi dùng Back để quay lại. Lặp lại hai lần trong 20 giây.',
  listenerCleanup: 'Dọn dẹp listener',
  windowListenersRetainingRecordsAfterUnmount:
    'Listener trên window giữ lại bản ghi sau khi unmount.',
  runTheListenerProbeNavigateToOverview:
    'Chạy listener probe, chuyển đến Overview rồi dùng Back để quay lại hai lần, sau đó chạy probe lần nữa và reset các listener của thí nghiệm.',
  detachedDomCleanup: 'Dọn dẹp DOM đã tách',
  closedDrawerChartNodesRetainedInA:
    'Các node biểu đồ của ngăn chi tiết đã đóng vẫn được giữ trong cache.',
  openARecordWaitForItsChart:
    'Mở bản ghi, đợi biểu đồ rồi đóng lại. Lặp lại ba lần và chọn Reset retained references.',
  defaultsExplanation:
    'Khi không có query parameters, /baseline và /optimized sử dụng kịch bản default. Optimized chỉ bật cách triển khai cho kịch bản đã chọn; không bật mọi tối ưu cùng lúc. Ví dụ, large-list bật ảo hóa danh sách, còn các kịch bản bộ nhớ tập trung vào dọn dẹp và lưu giữ tài nguyên nên vẫn có thể lag khi render toàn bộ danh sách.',
  parameterDefinitions:
    'scenario = thí nghiệm cần chạy; seed = dữ liệu có thể tái lập; count = số bản ghi.',
  language: 'Ngôn ngữ',
  scenarioDemos: 'Demo theo kịch bản',
  demoDataset: 'Demo: {count} bản ghi · seed 20260911',
  openBaseline: 'Mở baseline',
  openOptimized: 'Mở optimized',
  openScenario: '{action}: {name}',
  openFullScenario: '{action}: {name} — {workload}',
} satisfies Record<keyof typeof en, string>;
